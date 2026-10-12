import { IpcError } from '@/core/ipc';

export type TranscriptionRecovery =
  | { kind: 'record_again'; message: string }
  | { kind: 'setup'; message: string }
  | { kind: 'retry'; message: string };

const UNEXPECTED_FAILURE = 'Local transcription failed unexpectedly. Please retry.';

export function transcriptionRecovery(cause: unknown): TranscriptionRecovery {
  if (!(cause instanceof IpcError)) return { kind: 'retry', message: UNEXPECTED_FAILURE };
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
