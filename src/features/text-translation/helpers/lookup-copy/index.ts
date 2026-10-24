import { ipcFailureMessage } from '@/core/ipc';
import type { LookupFailure } from '../../types';

export const TRANSLATION_FAILED =
  'The text could not be translated. Check availability and try again.';
export const EXPLANATION_FAILED = 'The English explanation is unavailable. Retry to try again.';
export const INVALID_TEXT = 'Enter an English word or a short phrase (up to 8 words).';

export type FailureView = {
  readonly message: string;
  readonly needsPreparation: boolean;
  readonly canRetry: boolean;
};

export function failureView(failure: LookupFailure, fallback: string): FailureView {
  const code = failure._tag === 'IpcError' ? failure.code : undefined;
  return {
    message: ipcFailureMessage(failure, fallback),
    needsPreparation: code === 'download_required',
    canRetry: code !== 'download_required' && code !== 'invalid_request',
  };
}
