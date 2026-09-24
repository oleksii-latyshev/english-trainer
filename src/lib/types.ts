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

export type ProviderErrorCode =
  | 'unavailable'
  | 'timeout'
  | 'invalid_output'
  | 'process_failed'
  | 'invalid_request';

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
