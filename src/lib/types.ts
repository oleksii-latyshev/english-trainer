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
};

export type PracticeSession = {
  session_id: number;
  opening_question: string;
  turn_count: number;
};

export type FinishedPracticeSession = {
  session_id: number;
  finished: true;
};

export function isFinishedPracticeSession(value: unknown): value is FinishedPracticeSession {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'session_id' in value &&
    typeof value.session_id === 'number' &&
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0 &&
    'finished' in value &&
    value.finished === true
  );
}

export function isPracticeSession(value: unknown): value is PracticeSession {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'session_id' in value &&
    typeof value.session_id === 'number' &&
    Number.isSafeInteger(value.session_id) &&
    value.session_id > 0 &&
    'opening_question' in value &&
    typeof value.opening_question === 'string' &&
    value.opening_question.trim().length > 0 &&
    'turn_count' in value &&
    typeof value.turn_count === 'number' &&
    Number.isSafeInteger(value.turn_count) &&
    value.turn_count >= 0
  );
}

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
    typeof value.is_complete === 'boolean'
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
