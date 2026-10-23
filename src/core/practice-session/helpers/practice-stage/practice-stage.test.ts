import { describe, expect, it } from 'bun:test';
import { aSessionDetails } from '../../tests/builders';
import {
  canSendPracticeSource,
  canSendPracticeStage,
  canTransitionPracticePhase,
  isClockedStage,
  practiceKeepsMicrophoneWarm,
  practiceStageIsWriting,
  practiceStageUsesAudio,
} from '.';

const writing = aSessionDetails({
  sessionId: 3,
  turnCount: 2,
  practiceMode: 'write_then_speak',
  practicePhase: 'writing',
  writtenTurnCount: 2,
  spokenTurnCount: 0,
});

describe('practice stages', () => {
  it('keeps writing text-only and locks sends during review', () => {
    expect(practiceStageIsWriting(writing)).toBe(true);
    expect(practiceStageUsesAudio(writing)).toBe(false);
    expect(canSendPracticeStage(writing)).toBe(true);
    expect(canSendPracticeSource(writing, 'text')).toBe(true);
    expect(canSendPracticeSource(writing, 'voice')).toBe(false);
    expect(canSendPracticeStage({ ...writing, practicePhase: 'writing_review' })).toBe(false);
  });

  it('accepts only typed answers in a text chat', () => {
    const textChat = { ...writing, practiceMode: 'text_chat' as const };
    expect(canSendPracticeSource(textChat, 'text')).toBe(true);
    expect(canSendPracticeSource(textChat, 'voice')).toBe(false);
    expect(canSendPracticeSource(textChat, 'edited')).toBe(false);
  });

  it('allows only voice or edited answers for each remaining original question', () => {
    const speaking = { ...writing, practicePhase: 'speaking' as const };
    expect(practiceStageUsesAudio(speaking)).toBe(true);
    expect(canSendPracticeSource(speaking, 'voice')).toBe(true);
    expect(canSendPracticeSource(speaking, 'edited')).toBe(true);
    expect(canSendPracticeSource(speaking, 'text')).toBe(false);
    expect(canSendPracticeStage({ ...speaking, spokenTurnCount: 2 })).toBe(false);
    expect(canSendPracticeStage({ ...speaking, spokenTurnCount: 1 })).toBe(true);
  });
});

describe('usual-mistake practice input rules', () => {
  const drill = aSessionDetails({ isMistakePractice: true, targetTurns: 5, turnCount: 4 });

  it('accepts recognized or edited speech and rejects typing', () => {
    expect(canSendPracticeSource(drill, 'voice')).toBe(true);
    expect(canSendPracticeSource(drill, 'edited')).toBe(true);
    expect(canSendPracticeSource(drill, 'text')).toBe(false);
  });

  it('locks the composer after the fifth answer', () => {
    expect(canSendPracticeStage({ ...drill, turnCount: 5 })).toBe(false);
  });

  it('releases the warm microphone after the fifth answer', () => {
    expect(practiceKeepsMicrophoneWarm(drill)).toBe(true);
    expect(practiceKeepsMicrophoneWarm({ ...drill, turnCount: 5 })).toBe(false);
  });
});

describe('phase transitions', () => {
  const base = { mode: 'write_then_speak' as const, writtenCount: 2, spokenCount: 0 };

  it.each([
    ['writing', 'writing_review', true],
    ['writing_review', 'speaking', true],
    ['speaking', 'speaking_review', false],
    ['writing', 'speaking', false],
  ] as const)('%s to %s is %s', (phase, next, allowed) => {
    expect(canTransitionPracticePhase({ ...base, phase, next })).toBe(allowed);
  });

  it('reviews speaking only after every original question was spoken', () => {
    const spoken = { ...base, phase: 'speaking' as const, next: 'speaking_review' as const };
    expect(canTransitionPracticePhase({ ...spoken, spokenCount: 2 })).toBe(true);
  });

  it('never leaves a voice session', () => {
    expect(
      canTransitionPracticePhase({
        mode: 'voice',
        phase: 'speaking',
        next: 'speaking_review',
        writtenCount: 0,
        spokenCount: 0,
      }),
    ).toBe(false);
  });
});

describe('the session clock', () => {
  it('runs while the learner can answer and stops during reviews', () => {
    expect(isClockedStage(aSessionDetails())).toBe(true);
    expect(isClockedStage({ ...writing, practicePhase: 'writing_review' })).toBe(false);
    expect(isClockedStage({ ...writing, practiceMode: 'text_chat' })).toBe(true);
  });
});
