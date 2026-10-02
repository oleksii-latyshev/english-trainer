export type Transcript = {
  text: string;
  language: string;
  duration_ms: number;
};

export type TranscriptionErrorCode =
  | 'invalid_audio'
  | 'no_speech'
  | 'model_missing'
  | 'engine_missing'
  | 'engine_failed'
  | 'timeout'
  | 'io_failure'
  | 'invalid_output';

export type TranscriptionError = {
  code: TranscriptionErrorCode;
  message: string;
};

export type ConversationTurn = {
  spoken_reply: string;
  question: string | null;
  session_phase: string;
  is_complete: boolean;
  provider_latency_ms?: number;
};

export type FeedbackCategory = 'grammar' | 'vocabulary' | 'coherence' | 'interaction';

export type TurnFeedback = {
  focus_feedback: {
    category: FeedbackCategory;
    original: string;
    improved: string;
    explanation: string;
  }[];
  b2_rewrite: string;
};

export type AttemptComparison = {
  turn_sequence: number;
  original_transcript: string;
  retry_transcript: string;
  target: string;
  target_evidence:
    | 'already_present_in_both'
    | 'newly_observed_in_retry'
    | 'partially_observed'
    | 'not_observed'
    | 'uncertain';
  word_count_change: number;
  hesitation: string;
};

export function isAttemptComparison(value: unknown): value is AttemptComparison {
  return (
    typeof value === 'object' &&
    value !== null &&
    'turn_sequence' in value &&
    typeof value.turn_sequence === 'number' &&
    Number.isSafeInteger(value.turn_sequence) &&
    value.turn_sequence > 0 &&
    'original_transcript' in value &&
    isBoundedText(value.original_transcript, 4000) &&
    'retry_transcript' in value &&
    isBoundedText(value.retry_transcript, 4000) &&
    'target' in value &&
    typeof value.target === 'string' &&
    value.target.length <= 300 &&
    'target_evidence' in value &&
    (value.target_evidence === 'already_present_in_both' ||
      value.target_evidence === 'newly_observed_in_retry' ||
      value.target_evidence === 'partially_observed' ||
      value.target_evidence === 'not_observed' ||
      value.target_evidence === 'uncertain') &&
    'word_count_change' in value &&
    typeof value.word_count_change === 'number' &&
    Number.isSafeInteger(value.word_count_change) &&
    'hesitation' in value &&
    typeof value.hesitation === 'string'
  );
}

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return (
    value === 'grammar' ||
    value === 'vocabulary' ||
    value === 'coherence' ||
    value === 'interaction'
  );
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export function isTurnFeedback(value: unknown): value is TurnFeedback {
  if (typeof value !== 'object' || value === null) return false;
  if (!('b2_rewrite' in value) || !isBoundedText(value.b2_rewrite, 300)) return false;
  if (!('focus_feedback' in value) || !Array.isArray(value.focus_feedback)) return false;
  return (
    value.focus_feedback.length <= 1 &&
    value.focus_feedback.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'category' in item &&
        isFeedbackCategory(item.category) &&
        'original' in item &&
        isBoundedText(item.original, 300) &&
        'improved' in item &&
        isBoundedText(item.improved, 300) &&
        'explanation' in item &&
        isBoundedText(item.explanation, 300),
    )
  );
}

export {
  isPracticeSession,
  isSavedCoachState,
  isSessionMode,
  type PracticeSession,
  type SavedCoachState,
  type SessionMode,
} from './practiceSessionTypes';

export type QuestionScaffold = {
  sentence_starters: string[];
  useful_expressions: string[];
  structure: string[];
};

function isShortTextList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 3 &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 120)
  );
}

export function isQuestionScaffold(value: unknown): value is QuestionScaffold {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'sentence_starters' in value &&
    isShortTextList(value.sentence_starters) &&
    'useful_expressions' in value &&
    isShortTextList(value.useful_expressions) &&
    'structure' in value &&
    isShortTextList(value.structure)
  );
}

export {
  type DailyRecallPlan,
  isDailyRecallPlan,
  isSpokenRecallResult,
  type SpokenRecallResult,
} from './dailyRecallTypes';
export { type FinishedPracticeSession, isFinishedPracticeSession } from './finishedPracticeSession';
export type { ComponentCheck, ComponentStatus, SetupDiagnostics } from './setupTypes';

export type ProviderErrorCode =
  | 'unavailable'
  | 'timeout'
  | 'invalid_output'
  | 'process_failed'
  | 'invalid_request'
  | 'invalid_session'
  | 'busy'
  | 'database_error';

export type ProviderError = {
  code: ProviderErrorCode;
  message: string;
};

export function isTranscript(value: unknown): value is Transcript {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'text' in value &&
    typeof value.text === 'string' &&
    'language' in value &&
    typeof value.language === 'string' &&
    'duration_ms' in value &&
    typeof value.duration_ms === 'number'
  );
}

function isTranscriptionErrorCode(value: unknown): value is TranscriptionErrorCode {
  switch (value) {
    case 'invalid_audio':
    case 'no_speech':
    case 'model_missing':
    case 'engine_missing':
    case 'engine_failed':
    case 'timeout':
    case 'io_failure':
    case 'invalid_output':
      return true;
    default:
      return false;
  }
}

export function isTranscriptionError(value: unknown): value is TranscriptionError {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'code' in value &&
    isTranscriptionErrorCode(value.code) &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

export function isConversationTurn(value: unknown): value is ConversationTurn {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'spoken_reply' in value &&
    typeof value.spoken_reply === 'string' &&
    'question' in value &&
    (typeof value.question === 'string' || value.question === null) &&
    'session_phase' in value &&
    typeof value.session_phase === 'string' &&
    'is_complete' in value &&
    typeof value.is_complete === 'boolean' &&
    (!('provider_latency_ms' in value) ||
      (typeof value.provider_latency_ms === 'number' &&
        Number.isSafeInteger(value.provider_latency_ms) &&
        value.provider_latency_ms >= 0))
  );
}

function isProviderErrorCode(value: unknown): value is ProviderErrorCode {
  switch (value) {
    case 'unavailable':
    case 'timeout':
    case 'invalid_output':
    case 'process_failed':
    case 'invalid_request':
    case 'invalid_session':
    case 'busy':
    case 'database_error':
      return true;
    default:
      return false;
  }
}

export function isProviderError(value: unknown): value is ProviderError {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'code' in value &&
    isProviderErrorCode(value.code) &&
    'message' in value &&
    typeof value.message === 'string'
  );
}
