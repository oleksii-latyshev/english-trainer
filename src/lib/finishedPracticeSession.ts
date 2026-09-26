export type FinishedPracticeSession = {
  session_id: number;
  finished: true;
  turn_count: number;
  retry_count: number;
  target_turns: number;
  recall_count: number;
  recall_wording_count: number;
};

export function isFinishedPracticeSession(value: unknown): value is FinishedPracticeSession {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'session_id' in value &&
    typeof value.session_id === 'number' &&
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0 &&
    'finished' in value &&
    value.finished === true &&
    'turn_count' in value &&
    typeof value.turn_count === 'number' &&
    Number.isSafeInteger(value.turn_count) &&
    value.turn_count >= 0 &&
    'retry_count' in value &&
    typeof value.retry_count === 'number' &&
    Number.isSafeInteger(value.retry_count) &&
    value.retry_count >= 0 &&
    value.retry_count <= value.turn_count &&
    'target_turns' in value &&
    typeof value.target_turns === 'number' &&
    Number.isSafeInteger(value.target_turns) &&
    value.target_turns > 0 &&
    'recall_count' in value &&
    typeof value.recall_count === 'number' &&
    Number.isSafeInteger(value.recall_count) &&
    value.recall_count >= 0 &&
    'recall_wording_count' in value &&
    typeof value.recall_wording_count === 'number' &&
    Number.isSafeInteger(value.recall_wording_count) &&
    value.recall_wording_count >= 0 &&
    value.recall_wording_count <= value.recall_count
  );
}
