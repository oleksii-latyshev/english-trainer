import { describe, expect, it } from 'bun:test';
import {
  advanceCoachTurn,
  advancePractice,
  recordCoachAnswer,
  recordRetryComparison,
  setTurnPending,
  updateCoachFeedback,
} from './practiceState';

describe('practice prompt progression', () => {
  const active = {
    tag: 'active',
    sessionId: 7,
    mode: 'conversation',
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
    expect(advancePractice(active, 7, 'I went hiking.', turn)).toEqual({
      ...active,
      question: 'What happened next?',
      turnCount: 2,
      coachState: {
        session_id: 7,
        sequence: 2,
        answered_question: 'How was your day?',
        original_transcript: 'I went hiking.',
        feedback: null,
        is_pending: false,
      },
    });
  });

  it('ignores a reply from an older session', () => {
    expect(advancePractice(active, 6, 'stale', turn)).toBe(active);
  });

  it('keeps the session waiting until the provider request settles', () => {
    const waiting = setTurnPending(active, true);
    expect(waiting.tag).toBe('waiting');
    expect(advancePractice(waiting, 7, 'answer', turn)).toMatchObject({
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

  it('keeps the first Coach answer pending until Continue, then advances without adding a turn', () => {
    const coach = { ...active, mode: 'coach', targetTurns: 4 };
    const saved = {
      session_id: 7,
      sequence: 2,
      answered_question: 'What happened next?',
      original_transcript: 'I visited the museum.',
      feedback: null,
      is_pending: true,
    };
    const pending = recordCoachAnswer(coach, 7, saved);
    expect(pending).toMatchObject({
      tag: 'active',
      turnCount: 2,
      question: coach.question,
      coachState: saved,
    });
    const advanced = advanceCoachTurn(pending, 7, { ...turn, question: 'What did you learn?' });
    expect(advanced).toMatchObject({
      tag: 'active',
      turnCount: 2,
      question: 'What did you learn?',
      coachState: { ...saved, is_pending: false },
    });
  });

  it('updates only feedback for the matching saved answer and ignores another session', () => {
    const coach = recordCoachAnswer({ ...active, mode: 'coach' }, 7, {
      session_id: 7,
      sequence: 1,
      answered_question: 'How was your day?',
      original_transcript: 'I went hiking.',
      feedback: null,
      is_pending: true,
    });
    const feedback = { focus_feedback: [], b2_rewrite: 'I enjoyed hiking in the hills.' };
    expect(updateCoachFeedback(coach, 7, 1, feedback).coachState?.feedback).toEqual(feedback);
    expect(updateCoachFeedback(coach, 7, 2, feedback)).toBe(coach);
    expect(updateCoachFeedback(coach, 6, 1, feedback)).toBe(coach);
  });
});
