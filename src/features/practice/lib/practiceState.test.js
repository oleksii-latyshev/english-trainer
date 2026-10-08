import { describe, expect, it } from 'bun:test';
import {
  advancePractice,
  recordRetryComparison,
  setTurnPending,
  updateSummary,
} from './practiceState';

describe('practice prompt progression', () => {
  const active = {
    tag: 'active',
    sessionId: 7,
    question: 'How was your day?',
    turnCount: 1,
    targetTurns: 8,
    retryEvidence: [],
  };
  const turn = {
    spoken_reply: 'That sounds interesting.',
    question: 'What happened next?',
    session_phase: 'active',
    is_complete: false,
  };

  it('shows the next question after a successful turn', () => {
    expect(advancePractice(active, 7, turn)).toEqual({
      ...active,
      question: 'What happened next?',
      turnCount: 2,
    });
  });

  it('ignores a reply from an older session', () => {
    expect(advancePractice(active, 6, turn)).toBe(active);
  });

  it('keeps the session waiting until the provider request settles', () => {
    const waiting = setTurnPending(active, true);
    expect(waiting.tag).toBe('waiting');
    expect(advancePractice(waiting, 7, turn)).toMatchObject({
      question: 'What happened next?',
    });
    expect(setTurnPending(waiting, false).tag).toBe('active');
  });

  it('shows a saved retry immediately without advancing the conversation', () => {
    const comparison = { turn_sequence: 1, retry_transcript: 'I work there now.' };
    const updated = recordRetryComparison(active, 7, comparison);
    expect(updated).toMatchObject({
      question: active.question,
      turnCount: active.turnCount,
      retryEvidence: [comparison],
    });
    expect(
      recordRetryComparison(updated, 7, { ...comparison, retry_transcript: 'I work there.' })
        .retryEvidence,
    ).toHaveLength(1);
    expect(recordRetryComparison(active, 6, comparison)).toBe(active);
  });

  it('replaces the wrap-up with a fuller one for the same session only', () => {
    const completed = { tag: 'completed', summary: { session_id: 7, phrases: [] } };
    const fuller = { session_id: 7, phrases: [{ phrase: 'I work there' }] };
    expect(updateSummary(completed, fuller)).toEqual({ tag: 'completed', summary: fuller });
    expect(updateSummary(completed, { ...fuller, session_id: 8 })).toBe(completed);
    expect(updateSummary(active, fuller)).toBe(active);
  });
});
