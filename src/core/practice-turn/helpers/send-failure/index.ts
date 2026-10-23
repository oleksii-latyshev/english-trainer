import type { IpcDecodeError, IpcError } from '@/core/ipc';
import type { SendFailure } from '../../types';

export const REPLY_UNAVAILABLE_MESSAGE =
  'The AI follow-up could not be generated. Please try again.';

const SETUP_CODES: readonly string[] = ['unavailable', 'unauthorized'];
const UNRESPONSIVE_CODES: readonly string[] = [
  'timeout',
  'rate_limited',
  'process_failed',
  'invalid_output',
];

export function sendFailureOf(failure: IpcError | IpcDecodeError): SendFailure {
  if (failure._tag === 'IpcDecodeError') {
    return { message: REPLY_UNAVAILABLE_MESSAGE, needsSetup: false, isUnresponsive: false };
  }
  return {
    message: failure.message.trim().length > 0 ? failure.message : REPLY_UNAVAILABLE_MESSAGE,
    needsSetup: SETUP_CODES.includes(failure.code),
    isUnresponsive: UNRESPONSIVE_CODES.includes(failure.code),
  };
}
