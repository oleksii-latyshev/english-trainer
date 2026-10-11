import type { IpcErrorCode } from '@/core/ipc';
import type { GeminiKeyFailure } from '../../types';

const FALLBACK = 'Could not update the Gemini API key. Please try again.';

const COPY_FOR_EVERY_CODE: Record<IpcErrorCode, string> = {
  unavailable: 'Could not access the saved Gemini API key. Paste it again in Settings.',
  unauthorized:
    'The saved Gemini API key cannot be read on this computer. Paste it again in Settings.',
  invalid_request: 'That does not look like a Gemini API key. Copy it again from Google AI Studio.',
  rate_limited: FALLBACK,
  timeout: FALLBACK,
  cancelled: FALLBACK,
  invalid_output: FALLBACK,
  process_failed: FALLBACK,
  busy: FALLBACK,
  invalid_session: FALLBACK,
  database_error: FALLBACK,
};

export function keyErrorMessage(failure: GeminiKeyFailure): string {
  if (failure._tag === 'IpcDecodeError') return FALLBACK;
  return COPY_FOR_EVERY_CODE[failure.code];
}
