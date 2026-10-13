import { Effect, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import {
  MICROPHONE_TEST_DURATION_MS,
  type MicrophoneTestRecording,
  microphoneTestState,
} from '../helpers/microphone-test';
import { type AudioInputs, AudioInputsService } from '../services/audio-inputs-service';
import { ClipRecorder, IDLE_CLIP } from '../services/clip-recorder-service';
import { Microphone } from '../services/microphone-service';
import { WarmMicrophone } from '../services/warm-microphone-service';
import { audioAtomRuntime } from './runtime';

export type AudioInputsState = AudioInputs & { readonly error: string | null };

export const microphoneSnapshotAtom = Atom.keepAlive(
  audioAtomRuntime.subscriptionRef(
    Effect.gen(function* () {
      const warm = yield* WarmMicrophone;
      return warm.snapshot;
    }),
  ),
);

export const actualInputAtom = Atom.keepAlive(
  audioAtomRuntime.subscriptionRef(
    Effect.gen(function* () {
      const microphone = yield* Microphone;
      return microphone.lastInput;
    }),
  ),
);

export const audioInputsAtom = audioAtomRuntime.atom(
  Stream.unwrap(
    Effect.gen(function* () {
      const inputs = yield* AudioInputsService;
      const initial = Stream.make(undefined);
      return Stream.concat(initial, inputs.changes).pipe(
        Stream.mapEffect(() =>
          inputs.list.pipe(
            Effect.map((listed): AudioInputsState => ({ ...listed, error: null })),
            Effect.catch((failure) =>
              Effect.succeed<AudioInputsState>({
                options: [],
                hasUnnamed: false,
                error: failure.message,
              }),
            ),
          ),
        ),
      );
    }),
  ),
);

export const clipPhaseAtom = Atom.keepAlive(
  audioAtomRuntime.subscriptionRef(
    Effect.gen(function* () {
      const recorder = yield* ClipRecorder;
      return recorder.phase;
    }),
  ),
);

export const stopClipAtom = audioAtomRuntime.fn(
  Effect.fn('stopClip')(function* (_: undefined) {
    const recorder = yield* ClipRecorder;
    yield* recorder.stop;
  }),
);

export const microphoneTestRunAtom = audioAtomRuntime.fn(
  Effect.fn('microphoneTest')(function* (deviceId: string, get: Atom.FnContext) {
    const recorder = yield* ClipRecorder;
    const clip = yield* recorder.record({ deviceId, maxMs: MICROPHONE_TEST_DURATION_MS });
    const playbackUrl = URL.createObjectURL(clip.wav);
    get.addFinalizer(() => URL.revokeObjectURL(playbackUrl));
    get.refresh(audioInputsAtom);
    return {
      playbackUrl,
      durationMs: clip.durationMs,
      signal: clip.signal,
      input: clip.input,
    } satisfies MicrophoneTestRecording;
  }),
);

export const microphoneTestAtom = Atom.make((get) =>
  microphoneTestState(
    AsyncResult.getOrElse(get(clipPhaseAtom), () => IDLE_CLIP),
    get(microphoneTestRunAtom),
  ),
);
