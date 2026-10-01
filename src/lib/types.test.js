import { describe, expect, it } from 'bun:test';
import {
  isAttemptComparison,
  isConversationTurn,
  isDailyRecallPlan,
  isFinishedPracticeSession,
  isPracticeSession,
  isProviderError,
  isQuestionScaffold,
  isSavedCoachState,
  isSessionMode,
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
    const finished = {
      session_id: 1,
      finished: true,
      turn_count: 3,
      retry_count: 1,
      target_turns: 8,
      recall_count: 1,
      recall_wording_count: 1,
      improvement: { turn_sequence: 2, target: 'I work there' },
      focus: {
        turn_sequence: 2,
        original: 'I work in there',
        improved: 'I work there',
        explanation: 'Drop the extra preposition.',
      },
      saved_phrases: ['I work there'],
    };
    expect(isFinishedPracticeSession(finished)).toBe(true);
    expect(isFinishedPracticeSession({ ...finished, saved_phrases: ['é'.repeat(300)] })).toBe(true);
    expect(
      isFinishedPracticeSession({ ...finished, improvement: null, focus: null, saved_phrases: [] }),
    ).toBe(true);
    expect(
      isFinishedPracticeSession({ ...finished, improvement: { turn_sequence: 0, target: 'word' } }),
    ).toBe(false);
    expect(isFinishedPracticeSession({ ...finished, saved_phrases: ['a', 'b', 'c', 'd'] })).toBe(
      false,
    );
    expect(isFinishedPracticeSession({ ...finished, retry_count: 4 })).toBe(false);
    expect(isFinishedPracticeSession({ ...finished, recall_wording_count: 2 })).toBe(false);
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

  it('accepts valid session modes and saved coach states', () => {
    expect(isSessionMode('conversation')).toBe(true);
    expect(isSessionMode('coach')).toBe(true);
    expect(isSessionMode('drills')).toBe(false);

    const validCoachState = {
      session_id: 1,
      sequence: 1,
      answered_question: 'What did you build?',
      original_transcript: 'I built a microservice.',
      feedback: null,
      is_pending: true,
    };
    expect(isSavedCoachState(validCoachState)).toBe(true);
    expect(
      isSavedCoachState({
        ...validCoachState,
        feedback: {
          focus_feedback: [
            {
              category: 'grammar',
              original: 'more fast',
              improved: 'faster',
              explanation: 'Use comparative adjective.',
            },
          ],
          b2_rewrite: 'It was significantly faster.',
        },
      }),
    ).toBe(true);
    expect(isSavedCoachState({ ...validCoachState, session_id: 0 })).toBe(false);
    expect(isSavedCoachState({ ...validCoachState, is_pending: 'yes' })).toBe(false);
    expect(
      isPracticeSession({
        session_id: 1,
        mode: 'coach',
        opening_question: 'Tell me about a trade-off.',
        turn_count: 1,
        target_turns: 4,
        retry_evidence: [],
        coach_state: { ...validCoachState, sequence: 2 },
      }),
    ).toBe(false);

    expect(
      isPracticeSession({
        session_id: 1,
        mode: 'coach',
        opening_question: 'Tell me about a trade-off.',
        turn_count: 1,
        target_turns: 4,
        retry_evidence: [],
        coach_state: validCoachState,
      }),
    ).toBe(true);
    expect(
      isPracticeSession({
        session_id: 2,
        mode: 'coach',
        opening_question: 'Tell me about a trade-off.',
        turn_count: 1,
        target_turns: 4,
        retry_evidence: [],
        coach_state: validCoachState,
      }),
    ).toBe(false);
  });
});
