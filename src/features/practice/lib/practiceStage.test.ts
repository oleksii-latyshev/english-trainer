// @ts-expect-error Bun provides this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  canSendPracticeSource,
  canSendPracticeStage,
  practiceKeepsMicrophoneWarm,
  practiceStageIsWriting,
  practiceStageUsesAudio,
} from './practiceStage';
import type { SessionDetails } from './practiceState';

const session: SessionDetails = {
  sessionId: 3,
  question: 'What did you build?',
  turnCount: 2,
  targetTurns: 8,
  retryEvidence: [],
  topicId: 'work_technology',
  topicLabel: 'Work & technology',
  topicCustom: null,
  durationGoalSeconds: 600,
  activeDurationMs: 0,
  startedAt: 1,
  isClockRunning: true,
  isMistakePractice: false,
  clockSnapshotAtMs: 0,
  practiceMode: 'write_then_speak',
  practicePhase: 'writing',
  writtenTurnCount: 2,
  spokenTurnCount: 0,
};

describe('F11 practice stages', () => {
  it('keeps writing text-only and locks sends during review', () => {
    expect(practiceStageIsWriting(session)).toBe(true);
    expect(practiceStageUsesAudio(session)).toBe(false);
    expect(canSendPracticeStage(session)).toBe(true);
    expect(canSendPracticeSource(session, 'text')).toBe(true);
    expect(canSendPracticeSource(session, 'voice')).toBe(false);
    expect(canSendPracticeStage({ ...session, practicePhase: 'writing_review' })).toBe(false);
    const textChat = {
      ...session,
      practiceMode: 'text_chat' as const,
      practicePhase: 'writing' as const,
    };
    expect(canSendPracticeSource(textChat, 'text')).toBe(true);
    expect(canSendPracticeSource(textChat, 'voice')).toBe(false);
    expect(canSendPracticeSource(textChat, 'edited')).toBe(false);
  });

  it('allows only voice or edited answers for each remaining original question', () => {
    const speaking = { ...session, practicePhase: 'speaking' as const };
    expect(practiceStageUsesAudio(speaking)).toBe(true);
    expect(practiceStageIsWriting(speaking)).toBe(false);
    expect(canSendPracticeSource(speaking, 'voice')).toBe(true);
    expect(canSendPracticeSource(speaking, 'edited')).toBe(true);
    expect(canSendPracticeSource(speaking, 'text')).toBe(false);
    expect(canSendPracticeStage({ ...speaking, spokenTurnCount: speaking.writtenTurnCount })).toBe(
      false,
    );
    expect(
      canSendPracticeStage({ ...speaking, spokenTurnCount: speaking.writtenTurnCount - 1 }),
    ).toBe(true);
  });
});

describe('usual-mistake practice input rules', () => {
  const drill = {
    ...session,
    practiceMode: 'voice' as const,
    practicePhase: 'speaking' as const,
    isMistakePractice: true,
    targetTurns: 5,
    turnCount: 4,
  };

  it('accepts recognized or edited speech and rejects typing', () => {
    expect(canSendPracticeSource(drill, 'voice')).toBe(true);
    expect(canSendPracticeSource(drill, 'edited')).toBe(true);
    expect(canSendPracticeSource(drill, 'text')).toBe(false);
  });

  it('locks the composer after the fifth answer', () => {
    expect(canSendPracticeStage({ ...drill, turnCount: 5 })).toBe(false);
    expect(canSendPracticeSource({ ...drill, turnCount: 5 }, 'voice')).toBe(false);
  });

  it('releases the warm microphone after the fifth answer and keeps it for F11 speech', () => {
    expect(practiceKeepsMicrophoneWarm(drill)).toBe(true);
    expect(practiceKeepsMicrophoneWarm({ ...drill, turnCount: 5 })).toBe(false);
    expect(
      practiceKeepsMicrophoneWarm({
        ...session,
        practiceMode: 'write_then_speak',
        practicePhase: 'speaking',
      }),
    ).toBe(true);
  });
});
