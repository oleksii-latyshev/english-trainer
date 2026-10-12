import { Effect, Stream } from 'effect';
import { Atom } from 'effect/reactivity';
import { type AudioInputs, AudioInputsService } from '../services/audio-inputs-service';
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
