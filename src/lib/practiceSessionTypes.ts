import {
  type AttemptComparison,
  isAttemptComparison,
  isTurnFeedback,
  type TurnFeedback,
} from './types';

export type SessionMode = 'conversation' | 'coach';

export function isSessionMode(value: unknown): value is SessionMode {
  return value === 'conversation' || value === 'coach';
}

export type SavedCoachState = {
  session_id: number;
  sequence: number;
  answered_question: string;
  original_transcript: string;
  feedback: TurnFeedback | null;
  is_pending: boolean;
};

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export function isSavedCoachState(value: unknown): value is SavedCoachState {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'session_id' in value &&
    Number.isSafeInteger(value.session_id) &&
    typeof value.session_id === 'number' &&
    value.session_id > 0 &&
    'sequence' in value &&
    Number.isSafeInteger(value.sequence) &&
    typeof value.sequence === 'number' &&
    value.sequence > 0 &&
    'answered_question' in value &&
    isBoundedText(value.answered_question, 500) &&
    'original_transcript' in value &&
    isBoundedText(value.original_transcript, 4000) &&
    'is_pending' in value &&
    typeof value.is_pending === 'boolean' &&
    'feedback' in value &&
    (value.feedback === null || isTurnFeedback(value.feedback))
  );
}

export type PracticeSession = {
  session_id: number;
  mode?: SessionMode;
  opening_question: string;
  turn_count: number;
  target_turns: number;
  retry_evidence: AttemptComparison[];
  coach_state?: SavedCoachState | null;
};

export function isPracticeSession(value: unknown): value is PracticeSession {
  if (typeof value !== 'object' || value === null) return false;
  if (!('session_id' in value) || typeof value.session_id !== 'number') return false;
  if (!('turn_count' in value) || typeof value.turn_count !== 'number') return false;
  if ('coach_state' in value && value.coach_state !== null && value.coach_state !== undefined) {
    if (
      !isSavedCoachState(value.coach_state) ||
      value.coach_state.session_id !== value.session_id ||
      value.coach_state.sequence > value.turn_count ||
      (value.coach_state.is_pending && value.coach_state.sequence !== value.turn_count)
    )
      return false;
  }
  return (
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0 &&
    (!('mode' in value) || isSessionMode(value.mode)) &&
    'opening_question' in value &&
    isBoundedText(value.opening_question, 500) &&
    Number.isSafeInteger(value.turn_count) &&
    value.turn_count >= 0 &&
    'target_turns' in value &&
    typeof value.target_turns === 'number' &&
    Number.isSafeInteger(value.target_turns) &&
    value.target_turns > 0 &&
    'retry_evidence' in value &&
    Array.isArray(value.retry_evidence) &&
    value.retry_evidence.every(isAttemptComparison)
  );
}
