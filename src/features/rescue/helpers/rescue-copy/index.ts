import { ipcFailureMessage } from '@/core/ipc';
import type { RescueFailure } from '../../types';

export const RESCUE_LOADING = 'Finding a short suggestion…';

const UNAVAILABLE = 'Rescue help is unavailable. Keep speaking and try again.';

export function rescueFailureMessage(failure: RescueFailure): string {
  if (failure._tag === 'MicrophoneError') return failure.message;
  return ipcFailureMessage(failure, UNAVAILABLE);
}
