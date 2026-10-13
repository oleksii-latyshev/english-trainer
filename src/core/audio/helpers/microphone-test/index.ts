import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ActualAudioInput } from '../../audio';
import type { MicrophoneError } from '../../errors';
import type { ClipPhase } from '../../services/clip-recorder-service';
import type { AudioSignalSummary } from '../audio-signal';

export const MICROPHONE_TEST_DURATION_MS = 10_000;

const TEST_DISCONNECTED_MESSAGE =
  'The microphone disconnected during recording. Reconnect it and try again.';

export type MicrophoneTestRecording = {
  readonly playbackUrl: string;
  readonly durationMs: number;
  readonly signal: AudioSignalSummary;
  readonly input: ActualAudioInput;
};

type Progress = {
  readonly elapsedMs: number;
  readonly level: number;
  readonly input: ActualAudioInput;
};

export type MicrophoneTestState =
  | { readonly tag: 'idle' }
  | { readonly tag: 'requesting' }
  | ({ readonly tag: 'recording' } & Progress)
  | ({ readonly tag: 'stopping' } & Progress)
  | ({ readonly tag: 'recorded' } & MicrophoneTestRecording)
  | { readonly tag: 'error'; readonly failure: MicrophoneError };

export function microphoneTestFailureMessage(failure: MicrophoneError): string {
  return failure.reason === 'disconnected' ? TEST_DISCONNECTED_MESSAGE : failure.message;
}

function runningState(phase: ClipPhase): MicrophoneTestState {
  if (phase.tag === 'recording' || phase.tag === 'stopping') return phase;
  return { tag: 'requesting' };
}

export function microphoneTestState(
  phase: ClipPhase,
  run: AsyncResult.AsyncResult<MicrophoneTestRecording, MicrophoneError>,
): MicrophoneTestState {
  if (AsyncResult.isWaiting(run)) return runningState(phase);
  const recording = AsyncResult.value(run);
  if (Option.isSome(recording)) return { tag: 'recorded', ...recording.value };
  const failure = AsyncResult.error(run);
  if (Option.isSome(failure)) return { tag: 'error', failure: failure.value };
  return { tag: 'idle' };
}

export function isMicrophoneTestCapturing(state: MicrophoneTestState): boolean {
  return state.tag === 'requesting' || state.tag === 'recording' || state.tag === 'stopping';
}
