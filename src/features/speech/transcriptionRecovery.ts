import { isTranscriptionError } from '@/lib/types';

export type TranscriptionRecovery =
  | { kind: 'record_again'; message: string }
  | { kind: 'setup'; message: string }
  | { kind: 'retry'; message: string };

export function transcriptionRecovery(cause: unknown): TranscriptionRecovery {
  if (!isTranscriptionError(cause)) {
    return {
      kind: 'retry',
      message: 'Local transcription failed unexpectedly. Please retry.',
    };
  }

  switch (cause.code) {
    case 'invalid_audio':
    case 'no_speech':
      return { kind: 'record_again', message: cause.message };
    case 'model_missing':
    case 'engine_missing':
      return { kind: 'setup', message: cause.message };
    default:
      return { kind: 'retry', message: cause.message };
  }
}
