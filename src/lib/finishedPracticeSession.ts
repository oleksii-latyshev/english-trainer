export type FinishedPracticeSession = {
  session_id: number;
  finished: true;
  turn_count: number;
  retry_count: number;
  target_turns: number;
  recall_count: number;
  recall_wording_count: number;
  improvement: { turn_sequence: number; target: string } | null;
  focus: {
    turn_sequence: number;
    original: string;
    improved: string;
    explanation: string;
  } | null;
  saved_phrases: string[];
};

function isTurnNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isSummaryText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= 300;
}

function isImprovement(
  value: unknown,
): value is NonNullable<FinishedPracticeSession['improvement']> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'turn_sequence' in value &&
    isTurnNumber(value.turn_sequence) &&
    'target' in value &&
    isSummaryText(value.target)
  );
}

function isFocus(value: unknown): value is NonNullable<FinishedPracticeSession['focus']> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'turn_sequence' in value &&
    isTurnNumber(value.turn_sequence) &&
    'original' in value &&
    isSummaryText(value.original) &&
    'improved' in value &&
    isSummaryText(value.improved) &&
    'explanation' in value &&
    isSummaryText(value.explanation)
  );
}

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
    value.recall_wording_count <= value.recall_count &&
    'improvement' in value &&
    (value.improvement === null || isImprovement(value.improvement)) &&
    'focus' in value &&
    (value.focus === null || isFocus(value.focus)) &&
    'saved_phrases' in value &&
    Array.isArray(value.saved_phrases) &&
    value.saved_phrases.length <= 3 &&
    value.saved_phrases.every(isSummaryText)
  );
}
