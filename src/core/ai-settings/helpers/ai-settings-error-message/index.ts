import type { AiSettingsFailure } from '../../types';

export function aiSettingsErrorMessage(failure: AiSettingsFailure, fallback: string): string {
  if (failure._tag === 'IpcDecodeError') return fallback;
  return failure.message.trim().length > 0 ? failure.message : fallback;
}
