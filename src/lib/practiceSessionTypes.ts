import { type AttemptComparison, isAttemptComparison } from './types';

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export type PracticeSession = {
  session_id: number;
  opening_question: string;
  turn_count: number;
  target_turns: number;
  retry_evidence: AttemptComparison[];
};

export function isPracticeSession(value: unknown): value is PracticeSession {
  if (typeof value !== 'object' || value === null) return false;
  if (!('session_id' in value) || typeof value.session_id !== 'number') return false;
  if (!('turn_count' in value) || typeof value.turn_count !== 'number') return false;
  return (
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0 &&
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
