import type { IpcDecodeError, IpcError } from './errors';

export function ipcFailureMessage(failure: IpcError | IpcDecodeError, fallback: string): string {
  if (failure._tag === 'IpcDecodeError') return fallback;
  return failure.message.trim().length > 0 ? failure.message : fallback;
}
