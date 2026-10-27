import { Clock, Context, Deferred, Duration, Effect, Layer, SubscriptionRef } from 'effect';
import type { ActualAudioInput, RecordedAudio } from '../audio';
import { type MicrophoneError, microphoneBusy } from '../errors';
import type { Capture } from './capture-engine';
import { Microphone } from './microphone-service';

const TICK = Duration.millis(100);

type Recording = {
  readonly elapsedMs: number;
  readonly level: number;
  readonly input: ActualAudioInput;
};

export type ClipPhase =
  | { readonly tag: 'idle' }
  | { readonly tag: 'requesting' }
  | ({ readonly tag: 'recording' } & Recording)
  | ({ readonly tag: 'stopping' } & Recording);

export type RecordedClip = RecordedAudio & { readonly input: ActualAudioInput };

type ClipOptions = {
  readonly deviceId: string;
  readonly maxMs: number;
  readonly whileRecording?: (capture: Capture) => Effect.Effect<void>;
};

type ClipRecorderShape = {
  readonly phase: SubscriptionRef.SubscriptionRef<ClipPhase>;
  readonly record: (options: ClipOptions) => Effect.Effect<RecordedClip, MicrophoneError>;
  readonly stop: Effect.Effect<void>;
};

export const IDLE_CLIP: ClipPhase = { tag: 'idle' };

function trackRecording(
  phase: SubscriptionRef.SubscriptionRef<ClipPhase>,
  startedAtMs: number,
  level: Effect.Effect<number>,
) {
  return Effect.forever(
    Effect.sleep(TICK).pipe(
      Effect.andThen(Effect.all([Clock.currentTimeMillis, level])),
      Effect.flatMap(([nowMs, current]) =>
        SubscriptionRef.update(phase, (state) =>
          state.tag === 'recording'
            ? { ...state, elapsedMs: nowMs - startedAtMs, level: current }
            : state,
        ),
      ),
    ),
  );
}

export class ClipRecorder extends Context.Service<ClipRecorder, ClipRecorderShape>()(
  'core/audio/ClipRecorder',
) {
  static readonly layer = Layer.effect(
    ClipRecorder,
    Effect.gen(function* () {
      const microphone = yield* Microphone;
      const phase = yield* SubscriptionRef.make<ClipPhase>(IDLE_CLIP);
      let stopSignal: Deferred.Deferred<void> | null = null;

      function run(options: ClipOptions) {
        return Effect.gen(function* () {
          yield* SubscriptionRef.set(phase, { tag: 'requesting' });
          const signal = yield* Deferred.make<void>();
          stopSignal = signal;
          const session = yield* microphone.open({ deviceId: options.deviceId });
          yield* session.warmed;
          const capture = yield* session.capture({ preRollMs: 0 });
          const startedAtMs = yield* Clock.currentTimeMillis;
          yield* SubscriptionRef.set(phase, {
            tag: 'recording',
            elapsedMs: 0,
            level: 0,
            input: session.input,
          });
          yield* Effect.forkScoped(trackRecording(phase, startedAtMs, capture.level));
          if (options.whileRecording) yield* Effect.forkScoped(options.whileRecording(capture));
          yield* Effect.raceFirst(
            Deferred.await(signal),
            Effect.sleep(Duration.millis(options.maxMs)),
          ).pipe(Effect.raceFirst(session.lost));
          yield* SubscriptionRef.update(phase, (state) =>
            state.tag === 'recording' ? { ...state, tag: 'stopping' as const } : state,
          );
          const audio = yield* capture.stop;
          return { ...audio, input: session.input };
        }).pipe(Effect.scoped);
      }

      return {
        phase,
        record: (options) =>
          Effect.suspend(() => {
            if (SubscriptionRef.getUnsafe(phase).tag !== 'idle') return Effect.fail(microphoneBusy);
            return run(options).pipe(
              Effect.ensuring(
                Effect.suspend(() => {
                  stopSignal = null;
                  return SubscriptionRef.set(phase, IDLE_CLIP);
                }),
              ),
            );
          }),
        stop: Effect.sync(() => {
          if (stopSignal) Deferred.doneUnsafe(stopSignal, Effect.void);
        }),
      };
    }),
  );
}
