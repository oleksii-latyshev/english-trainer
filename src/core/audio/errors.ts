import { Data } from 'effect';
import { microphoneError } from './helpers/microphone-error';

export type MicrophoneFailure =
  | 'unsupported'
  | 'not-ready'
  | 'disconnected'
  | 'no-audio'
  | 'busy'
  | 'unknown';

export class MicrophoneError extends Data.TaggedError('MicrophoneError')<{
  readonly reason: MicrophoneFailure;
  readonly message: string;
}> {}

export const MIC_NOT_READY_MESSAGE =
  'The microphone did not become ready. Reconnect it and try again.';
export const MIC_DISCONNECTED_MESSAGE =
  'The microphone disconnected before recording. Reconnect it and try again.';
const MIC_UNSUPPORTED_MESSAGE = 'Microphone recording is unavailable in this app environment.';
const MIC_BUSY_MESSAGE = 'The microphone is already recording.';
const MIC_NO_AUDIO_MESSAGE = 'No microphone audio was captured. Please try again.';

export const microphoneUnsupported = new MicrophoneError({
  reason: 'unsupported',
  message: MIC_UNSUPPORTED_MESSAGE,
});
export const microphoneNotReady = new MicrophoneError({
  reason: 'not-ready',
  message: MIC_NOT_READY_MESSAGE,
});
export const microphoneDisconnected = new MicrophoneError({
  reason: 'disconnected',
  message: MIC_DISCONNECTED_MESSAGE,
});
export const microphoneNoAudio = new MicrophoneError({
  reason: 'no-audio',
  message: MIC_NO_AUDIO_MESSAGE,
});

export const microphoneBusy = new MicrophoneError({
  reason: 'busy',
  message: MIC_BUSY_MESSAGE,
});

export function microphoneFailureOf(cause: unknown): MicrophoneError {
  if (cause instanceof MicrophoneError) return cause;
  return new MicrophoneError({ reason: 'unknown', message: microphoneError(cause) });
}
