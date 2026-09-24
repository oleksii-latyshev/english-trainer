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
