import { describe, expect, it } from 'bun:test';
import {
  isAttemptComparison,
  isConversationTurn,
  isFinishedPracticeSession,
  isPracticeSession,
  isProviderError,
  isQuestionScaffold,
  isTurnFeedback,
} from './types';

describe('conversation IPC payloads', () => {
  it('accepts a typed spoken turn and rejects the CLI wrapper', () => {
    const turn = {
      spoken_reply: 'That sounds lovely.',
      question: 'What did you enjoy most?',
      session_phase: 'active',
      is_complete: false,
    };
    expect(isConversationTurn(turn)).toBe(true);
    expect(isConversationTurn({ ...turn, provider_latency_ms: 1200 })).toBe(true);
    expect(isConversationTurn({ ...turn, provider_latency_ms: -1 })).toBe(false);
    expect(isConversationTurn({ status: 'SUCCESS', structured_output: turn })).toBe(false);
    expect(isConversationTurn({ ...turn, question: 3 })).toBe(false);
  });

  it('accepts known provider errors only', () => {
    expect(isProviderError({ code: 'timeout', message: 'Try again.' })).toBe(true);
    expect(isProviderError({ code: 'invalid_session', message: 'Start a new session.' })).toBe(
      true,
    );
    expect(isProviderError({ code: 'database_error', message: 'Please retry.' })).toBe(true);
    expect(isProviderError({ code: 'unexpected', message: 'Internal data' })).toBe(false);
    expect(isProviderError('unavailable')).toBe(false);
  });

  it('requires a valid practice session identifier and opening question', () => {
    expect(
      isPracticeSession({
        session_id: 1,
        opening_question: 'How was your day?',
        turn_count: 2,
        target_turns: 8,
        retry_evidence: [],
      }),
    ).toBe(true);
    expect(
      isPracticeSession({
        session_id: 0,
        opening_question: 'How was your day?',
        turn_count: 0,
        target_turns: 8,
      }),
    ).toBe(false);
    expect(
      isPracticeSession({ session_id: 1, opening_question: '', turn_count: 0, target_turns: 8 }),
    ).toBe(false);
    expect(isPracticeSession({ session_id: 1, opening_question: 'Question?', turn_count: 0 })).toBe(
      false,
    );
    expect(isFinishedPracticeSession({ session_id: 1, finished: true })).toBe(true);
    expect(isFinishedPracticeSession({ session_id: 1, finished: false })).toBe(false);
  });

  it('accepts bounded question help and rejects malformed IPC data', () => {
    const hints = {
      sentence_starters: ['In my view…'],
      useful_expressions: ['for instance'],
      structure: ['State your view', 'Give a reason'],
    };
    expect(isQuestionScaffold(hints)).toBe(true);
    expect(isQuestionScaffold({ ...hints, structure: [] })).toBe(false);
    expect(isQuestionScaffold({ ...hints, sentence_starters: [4] })).toBe(false);
  });

  it('accepts one focused coaching item and a stronger rewrite', () => {
    const feedback = {
      focus_feedback: [
        {
          category: 'grammar',
          original: 'I go yesterday.',
          improved: 'I went yesterday.',
          explanation: 'Use the past tense for a finished event.',
        },
      ],
      b2_rewrite: 'Yesterday, I went there to catch up with a friend.',
    };
    expect(isTurnFeedback(feedback)).toBe(true);
    expect(
      isTurnFeedback({
        ...feedback,
        focus_feedback: [feedback.focus_feedback[0], feedback.focus_feedback[0]],
      }),
    ).toBe(false);
    expect(
      isTurnFeedback({
        ...feedback,
        focus_feedback: [{ ...feedback.focus_feedback[0], category: 'unknown' }],
      }),
    ).toBe(false);
    expect(isTurnFeedback({ ...feedback, b2_rewrite: '' })).toBe(false);
    expect(isTurnFeedback({ ...feedback, focus_feedback: [] })).toBe(true);
  });

  it('accepts grounded retry evidence and rejects malformed evidence', () => {
    const comparison = {
      turn_sequence: 1,
      original_transcript: 'I work in there.',
      retry_transcript: 'I work there now.',
      target: 'I work there',
      target_evidence: 'newly_observed_in_retry',
      word_count_change: 0,
      hesitation: 'Not measured from transcript text.',
    };
    expect(isAttemptComparison(comparison)).toBe(true);
    expect(isAttemptComparison({ ...comparison, target_evidence: 'fixed' })).toBe(false);
  });
});
