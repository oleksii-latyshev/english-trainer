import { describe, expect, it } from 'bun:test';
import { aPracticeSession, aSessionDetails } from '../../tests/builders';
import type { AttemptComparison, PracticeState } from '../../types';
import {
  advancePractice,
  recordRetryComparison,
  setTurnPending,
  updatePracticeClock,
  updateSummary,
} from '.';

const active: PracticeState = { tag: 'active', ...aSessionDetails() };
const turn = { spoken_reply: 'That sounds interesting.', question: 'What happened next?' };

function aComparison(overrides: Partial<AttemptComparison> = {}): AttemptComparison {
  return {
    turn_sequence: 1,
    original_transcript: 'I work there.',
    retry_transcript: 'I work there now.',
    target: 'work there',
    target_evidence: 'newly_observed_in_retry',
    word_count_change: 1,
    hesitation: 'none',
    ...overrides,
  };
}

describe('practice prompt progression', () => {
  it('shows the next question after a successful turn', () => {
    expect(advancePractice(active, 7, turn)).toMatchObject({
      question: 'What happened next?',
      turnCount: 2,
    });
  });

  it('keeps the reply as the prompt when the drill has no next question', () => {
    const drill: PracticeState = {
      tag: 'active',
      ...aSessionDetails({ isMistakePractice: true, turnCount: 4, targetTurns: 5 }),
    };
    expect(advancePractice(drill, 7, { ...turn, question: null })).toMatchObject({
      question: 'That sounds interesting.',
      turnCount: 5,
      isMistakePractice: true,
    });
  });

  it('counts written and spoken answers by stage', () => {
    const writing: PracticeState = {
      tag: 'active',
      ...aSessionDetails({
        turnCount: 0,
        practiceMode: 'write_then_speak',
        practicePhase: 'writing',
        spokenTurnCount: 0,
      }),
    };
    const afterWriting = advancePractice(writing, 7, turn);
    expect(afterWriting).toMatchObject({ turnCount: 1, writtenTurnCount: 1, spokenTurnCount: 0 });
    if (afterWriting.tag !== 'active') throw new Error('expected an active session');
    const speaking = { ...afterWriting, practicePhase: 'speaking' as const };
    expect(advancePractice(speaking, 7, turn)).toMatchObject({
      turnCount: 2,
      writtenTurnCount: 1,
      spokenTurnCount: 1,
    });
  });

  it('ignores a reply from another session', () => {
    expect(advancePractice(active, 6, turn)).toBe(active);
  });

  it('accepts a reply that arrives while the session waits for it', () => {
    const waiting = setTurnPending(active, true);
    expect(waiting.tag).toBe('waiting');
    expect(advancePractice(waiting, 7, turn)).toMatchObject({ question: 'What happened next?' });
    expect(setTurnPending(waiting, false).tag).toBe('active');
  });
});

describe('retry evidence', () => {
  it('shows a saved retry without advancing the conversation', () => {
    const updated = recordRetryComparison(active, 7, aComparison());
    expect(updated).toMatchObject({ question: 'How was your day?', turnCount: 1 });
    if (updated.tag !== 'active') throw new Error('expected an active session');
    expect(updated.retryEvidence).toEqual([aComparison()]);
  });

  it('replaces the comparison of the same answer', () => {
    const first = recordRetryComparison(active, 7, aComparison());
    const second = recordRetryComparison(first, 7, aComparison({ retry_transcript: 'Again.' }));
    if (second.tag !== 'active') throw new Error('expected an active session');
    expect(second.retryEvidence).toHaveLength(1);
  });

  it('ignores another session', () => {
    expect(recordRetryComparison(active, 6, aComparison())).toBe(active);
  });
});

describe('wrap-up', () => {
  const completed: PracticeState = { tag: 'completed', summary: { session_id: 7, phrases: [] } };

  it('replaces the wrap-up with a fuller one of the same session only', () => {
    const fuller = { session_id: 7, phrases: ['I work there'] };
    expect(updateSummary(completed, fuller)).toEqual({ tag: 'completed', summary: fuller });
    expect(updateSummary(completed, { ...fuller, session_id: 8 })).toBe(completed);
    expect(updateSummary(active, fuller)).toBe(active);
  });
});

describe('clock snapshots', () => {
  const snapshot = aPracticeSession({
    topic_id: 'plans_stories',
    topic_label: 'Plans & stories',
    duration_goal_seconds: 900,
    active_duration_ms: 65000,
    is_clock_running: false,
  });

  it('updates only the clock fields and keeps the turn state', () => {
    const advanced = advancePractice(active, 7, turn);
    expect(updatePracticeClock(advanced, snapshot, 5000)).toMatchObject({
      question: 'What happened next?',
      turnCount: 2,
      topicLabel: 'Plans & stories',
      durationGoalSeconds: 900,
      activeDurationMs: 65000,
      isClockRunning: false,
      clockSnapshotAtMs: 5000,
    });
  });

  it('ignores another session', () => {
    expect(updatePracticeClock(active, { ...snapshot, session_id: 8 }, 5000)).toBe(active);
  });
});
