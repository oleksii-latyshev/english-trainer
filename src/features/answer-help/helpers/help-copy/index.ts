import { ipcFailureMessage } from '@/core/ipc';
import type { HelpFailure } from '../../types';

export const HELP_NOT_MARKED = 'Help could not be marked. Try opening it again, or keep speaking.';

export const DESKTOP_ONLY = 'Answer help is available in the desktop app.';

export const PREPARING = 'Preparing help for this question…';

const UNAVAILABLE = 'Answer help is unavailable. You can keep speaking or retry.';

export function planFailureMessage(failure: HelpFailure): string {
  return ipcFailureMessage(failure, UNAVAILABLE);
}
