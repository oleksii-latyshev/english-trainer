import { describe, expect, it } from 'bun:test';
import { isFinishedPracticeSession } from './finishedPracticeSession';

const finished = {
  session_id: 1,
  finished: true,
  turn_count: 3,
  target_turns: 8,
  duration_ms: 624000,
  numbers: {
    speaking_time: { duration_ms: 290000, trend: { kind: 'percent', change: 12 } },
    words_per_minute: { value: 104, trend: { kind: 'same' } },
    average_answer: { words: 27, trend: { kind: 'words', change: -5 } },
  },
  phrases: [
    {
      sequence: 2,
      phrase: 'I work there',
      note: 'Drop the extra preposition.',
      you_said: 'I work in there',
    },
  ],
  recurring_mistakes: [
    {
      original: 'since two weeks',
      improved: 'for two weeks',
      explanation: 'for + a length of time',
      times: 2,
    },
  ],
  pending_coaching: 0,
  is_coaching_paused: false,
};

describe('session wrap-up payload', () => {
  it('accepts numbers, phrases and recurring mistakes', () => {
    expect(isFinishedPracticeSession(finished)).toBe(true);
  });

  it('accepts a session with nothing to measure or learn', () => {
    expect(
      isFinishedPracticeSession({
        ...finished,
        numbers: {
          speaking_time: { duration_ms: null, trend: { kind: 'first' } },
          words_per_minute: { value: null, trend: { kind: 'first' } },
          average_answer: { words: null, trend: { kind: 'first' } },
        },
        phrases: [],
        recurring_mistakes: [],
      }),
    ).toBe(true);
  });

  it('accepts a wrap-up that is still waiting for coaching or paused', () => {
    expect(isFinishedPracticeSession({ ...finished, pending_coaching: 3 })).toBe(true);
    expect(isFinishedPracticeSession({ ...finished, is_coaching_paused: true })).toBe(true);
    expect(isFinishedPracticeSession({ ...finished, pending_coaching: -1 })).toBe(false);
    expect(isFinishedPracticeSession({ ...finished, is_coaching_paused: 'yes' })).toBe(false);
    const { pending_coaching, ...withoutPending } = finished;
    expect(isFinishedPracticeSession(withoutPending)).toBe(false);
  });

  it('rejects a missing or malformed wrap-up', () => {
    const { numbers, ...withoutNumbers } = finished;
    expect(isFinishedPracticeSession(withoutNumbers)).toBe(false);
    expect(isFinishedPracticeSession({ ...finished, duration_ms: -1 })).toBe(false);
    expect(
      isFinishedPracticeSession({
        ...finished,
        numbers: { ...numbers, speaking_time: { duration_ms: 1, trend: { kind: 'up' } } },
      }),
    ).toBe(false);
    expect(
      isFinishedPracticeSession({
        ...finished,
        numbers: { ...numbers, average_answer: { trend: { kind: 'same' } } },
      }),
    ).toBe(false);
    expect(
      isFinishedPracticeSession({ ...finished, phrases: Array(4).fill(finished.phrases[0]) }),
    ).toBe(false);
    expect(
      isFinishedPracticeSession({
        ...finished,
        recurring_mistakes: [{ ...finished.recurring_mistakes[0], times: 1 }],
      }),
    ).toBe(false);
  });
});
