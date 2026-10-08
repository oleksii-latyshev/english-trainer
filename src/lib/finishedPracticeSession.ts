/** How a number moved against the last earlier session that has it. */
export type Trend =
  | { kind: 'first' }
  | { kind: 'same' }
  | { kind: 'percent'; change: number }
  | { kind: 'words'; change: number };

export type SessionNumbers = {
  speaking_time: { duration_ms: number | null; trend: Trend };
  words_per_minute: { value: number | null; trend: Trend };
  average_answer: { words: number | null; trend: Trend };
};

export type WrapupPhrase = {
  /** Sequence of the answer it came from; used as provenance when saved. */
  sequence: number;
  phrase: string;
  note: string;
  you_said: string;
};

export type RecurringMistake = {
  original: string;
  improved: string;
  explanation: string;
  times: number;
};

export type FinishedPracticeSession = {
  session_id: number;
  finished: true;
  turn_count: number;
  target_turns: number;
  duration_ms: number;
  numbers: SessionNumbers;
  phrases: WrapupPhrase[];
  recurring_mistakes: RecurringMistake[];
  /** Answers whose coaching has not landed yet; the lists grow when it does. */
  pending_coaching: number;
  /** Coaching is paused (Antigravity quota), so nothing more will land for now. */
  is_coaching_paused: boolean;
};

const MAX_WRAPUP_PHRASES = 3;
const MAX_WRAPUP_MISTAKES = 2;

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullableCount(value: unknown): value is number | null {
  return value === null || isCount(value);
}

function isTrend(value: unknown): value is Trend {
  if (typeof value !== 'object' || value === null || !('kind' in value)) return false;
  if (value.kind === 'first' || value.kind === 'same') return true;
  return (
    (value.kind === 'percent' || value.kind === 'words') &&
    'change' in value &&
    typeof value.change === 'number' &&
    Number.isSafeInteger(value.change)
  );
}

function isNumberWithTrend(value: unknown, field: string): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    field in value &&
    isNullableCount(Reflect.get(value, field)) &&
    'trend' in value &&
    isTrend(value.trend)
  );
}

function isSessionNumbers(value: unknown): value is SessionNumbers {
  return (
    typeof value === 'object' &&
    value !== null &&
    'speaking_time' in value &&
    isNumberWithTrend(value.speaking_time, 'duration_ms') &&
    'words_per_minute' in value &&
    isNumberWithTrend(value.words_per_minute, 'value') &&
    'average_answer' in value &&
    isNumberWithTrend(value.average_answer, 'words')
  );
}

function isWrapupPhrase(value: unknown): value is WrapupPhrase {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sequence' in value &&
    isTurnNumber(value.sequence) &&
    'phrase' in value &&
    isSummaryText(value.phrase) &&
    'note' in value &&
    typeof value.note === 'string' &&
    Array.from(value.note).length <= 500 &&
    'you_said' in value &&
    isSummaryText(value.you_said)
  );
}

function isRecurringMistake(value: unknown): value is RecurringMistake {
  return (
    typeof value === 'object' &&
    value !== null &&
    'original' in value &&
    isSummaryText(value.original) &&
    'improved' in value &&
    isSummaryText(value.improved) &&
    'explanation' in value &&
    isSummaryText(value.explanation) &&
    'times' in value &&
    isCount(value.times) &&
    value.times >= 2
  );
}

function isTurnNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isSummaryText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= 300;
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
    'target_turns' in value &&
    typeof value.target_turns === 'number' &&
    Number.isSafeInteger(value.target_turns) &&
    value.target_turns > 0 &&
    'duration_ms' in value &&
    isCount(value.duration_ms) &&
    'numbers' in value &&
    isSessionNumbers(value.numbers) &&
    'phrases' in value &&
    Array.isArray(value.phrases) &&
    value.phrases.length <= MAX_WRAPUP_PHRASES &&
    value.phrases.every(isWrapupPhrase) &&
    'recurring_mistakes' in value &&
    Array.isArray(value.recurring_mistakes) &&
    value.recurring_mistakes.length <= MAX_WRAPUP_MISTAKES &&
    value.recurring_mistakes.every(isRecurringMistake) &&
    'pending_coaching' in value &&
    isCount(value.pending_coaching) &&
    'is_coaching_paused' in value &&
    typeof value.is_coaching_paused === 'boolean'
  );
}
