import type { ActualAudioInput } from '@/audio/types';
import type { CaptureState, Recording } from './captureView';
import { transcriptionRecovery } from './transcriptionRecovery';

/** The state after a transcript arrived; `discard` is true when the raw audio is no longer needed. */
export function transcriptOutcome(
  text: string,
  recording: Recording,
  actualInput?: ActualAudioInput,
): CaptureState {
  if (!text.trim()) {
    return {
      tag: 'error',
      message: '',
      actualInput,
      failure: {
        kind: 'record_again',
        message: 'No speech was detected. Try speaking closer to the microphone.',
      },
    };
  }
  return {
    tag: 'transcript',
    text,
    durationMs: recording.durationMs,
    speechStoppedAtMs: recording.speechStoppedAtMs,
    actualInput,
  };
}

/** A retryable failure keeps the recording for another attempt; otherwise it is discarded. */
export function transcriptionErrorOutcome(
  recording: Recording,
  cause: unknown,
  actualInput?: ActualAudioInput,
): { state: CaptureState; keepsRecording: boolean } {
  const failure = transcriptionRecovery(cause);
  if (failure.kind === 'record_again') {
    return { state: { tag: 'error', message: '', failure, actualInput }, keepsRecording: false };
  }
  return { state: { ...recording, tag: 'ready', failure, actualInput }, keepsRecording: true };
}
