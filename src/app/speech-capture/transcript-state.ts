import type { ActualAudioInput } from '@/core/audio';
import { transcriptionFailureOutcome, transcriptOutcome } from '@/core/speech';
import type { CaptureState, Recording } from './capture-view';

export function transcriptState(
  text: string,
  recording: Recording,
  actualInput?: ActualAudioInput,
): CaptureState {
  const outcome = transcriptOutcome(text);
  if (outcome.tag === 'no-speech') {
    return { tag: 'error', message: '', actualInput, failure: outcome.failure };
  }
  return {
    tag: 'transcript',
    text: outcome.text,
    durationMs: recording.durationMs,
    speechStoppedAtMs: recording.speechStoppedAtMs,
    actualInput,
  };
}

export function transcriptionFailureState(
  recording: Recording,
  cause: unknown,
  actualInput?: ActualAudioInput,
): { state: CaptureState; keepsRecording: boolean } {
  const { failure, keepsRecording } = transcriptionFailureOutcome(cause);
  if (!keepsRecording) {
    return { state: { tag: 'error', message: '', failure, actualInput }, keepsRecording };
  }
  return { state: { ...recording, tag: 'ready', failure, actualInput }, keepsRecording };
}
