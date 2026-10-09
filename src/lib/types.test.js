import { describe, expect, it } from 'bun:test';
import {
  isAttemptComparison,
  isConversationTurn,
  isDailyRecallPlan,
  isFinishedPracticeSession,
  isPracticeSession,
  isProviderError,
  isQuestionScaffold,
  isSpokenRecallResult,
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
    expect(isConversationTurn({ ...turn, first_token_ms: 800 })).toBe(true);
    const answeredBy = { provider: 'apple', model: 'apple-foundation-models', is_backup: true };
    expect(isConversationTurn({ ...turn, answered_by: answeredBy })).toBe(true);
    expect(isConversationTurn({ ...turn, answered_by: { provider: 'x' } })).toBe(false);
    expect(isConversationTurn({ ...turn, answered_by: null })).toBe(false);
    expect(isConversationTurn({ ...turn, first_token_ms: 'fast' })).toBe(false);
    expect(isConversationTurn({ ...turn, question: null })).toBe(true);
    expect(isConversationTurn({ status: 'SUCCESS', structured_output: turn })).toBe(false);
    expect(isConversationTurn({ ...turn, question: 3 })).toBe(false);
  });

  it('accepts known provider errors only', () => {
    expect(isProviderError({ code: 'timeout', message: 'Try again.' })).toBe(true);
    expect(isProviderError({ code: 'unauthorized', message: 'Check the key.' })).toBe(true);
    expect(isProviderError({ code: 'rate_limited', message: 'Wait.' })).toBe(true);
    expect(
      isProviderError({ code: 'invalid_output', message: 'Retry.', reply_stage: 'schema' }),
    ).toBe(true);
    expect(
      isProviderError({ code: 'invalid_output', message: 'Retry.', reply_stage: 'unknown' }),
    ).toBe(false);
    expect(isProviderError({ code: 'invalid_session', message: 'Start a new session.' })).toBe(
      true,
    );
    expect(isProviderError({ code: 'database_error', message: 'Please retry.' })).toBe(true);
    expect(isProviderError({ code: 'unexpected', message: 'Internal data' })).toBe(false);
    expect(isProviderError('unavailable')).toBe(false);
  });

  it('requires a valid practice session identifier and opening question', () => {
    const validSession = {
      session_id: 1,
      opening_question: 'How was your day?',
      turn_count: 2,
      target_turns: 8,
      retry_evidence: [],
      topic_id: 'daily_life',
      topic_label: 'Daily life',
      topic_custom: null,
      duration_goal_seconds: 600,
      active_duration_ms: 30000,
      started_at: 1780000000000,
      is_clock_running: false,
    };
    expect(isPracticeSession(validSession)).toBe(true);
    expect(isPracticeSession({ ...validSession, topic_id: 'unknown' })).toBe(false);
    expect(isPracticeSession({ ...validSession, duration_goal_seconds: 420 })).toBe(false);
    expect(isPracticeSession({ ...validSession, active_duration_ms: -1 })).toBe(false);
    expect(
      isPracticeSession({
        session_id: 0,
        opening_question: 'How was your day?',
        turn_count: 0,
        target_turns: 8,
        topic_id: 'daily_life',
        topic_label: 'Daily life',
        topic_custom: null,
        duration_goal_seconds: 600,
        active_duration_ms: 0,
        started_at: 1780000000000,
        is_clock_running: false,
      }),
    ).toBe(false);
    expect(
      isPracticeSession({
        session_id: 1,
        opening_question: '',
        turn_count: 0,
        target_turns: 8,
        topic_id: 'daily_life',
        topic_label: 'Daily life',
        topic_custom: null,
        duration_goal_seconds: 600,
        active_duration_ms: 0,
        started_at: 1780000000000,
        is_clock_running: false,
      }),
    ).toBe(false);
    expect(isPracticeSession({ session_id: 1, opening_question: 'Question?', turn_count: 0 })).toBe(
      false,
    );
    const finished = {
      session_id: 1,
      finished: true,
      turn_count: 3,
      target_turns: 8,
      duration_ms: 624000,
      topic_label: 'Daily life',
      duration_goal_seconds: 600,
      numbers: {
        speaking_time: { duration_ms: null, trend: { kind: 'first' } },
        words_per_minute: { value: null, trend: { kind: 'first' } },
        average_answer: { words: 3, trend: { kind: 'first' } },
      },
      phrases: [],
      recurring_mistakes: [],
      pending_coaching: 0,
      is_coaching_paused: false,
    };
    expect(isFinishedPracticeSession(finished)).toBe(true);
    expect(isFinishedPracticeSession({ ...finished, turn_count: -1 })).toBe(false);
    expect(isFinishedPracticeSession({ ...finished, target_turns: 0 })).toBe(false);
    expect(isFinishedPracticeSession({ session_id: 1, finished: false })).toBe(false);
  });

  it('accepts bounded spoken recall plans and evidence', () => {
    const plan = { completed_count: 1, items: [{ phrase_id: 7, cue: 'A trade-off' }] };
    expect(isDailyRecallPlan(plan)).toBe(true);
    expect(isDailyRecallPlan({ ...plan, completed_count: 3 })).toBe(false);
    const result = {
      phrase_id: 7,
      transcript: 'The trade off matters.',
      target: 'trade-off',
      wording_observed: true,
    };
    expect(isSpokenRecallResult(result)).toBe(true);
    expect(isSpokenRecallResult({ ...result, wording_observed: 'yes' })).toBe(false);
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
    expect(isTurnFeedback({ ...feedback, b2_rewrite: 'word '.repeat(110).trim() })).toBe(true);
    expect(isTurnFeedback({ ...feedback, b2_rewrite: 'word '.repeat(130).trim() })).toBe(false);
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
