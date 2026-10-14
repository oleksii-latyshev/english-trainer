import { describe, expect, it } from 'bun:test';
import { Deferred, Effect, Exit, Fiber, Layer, Stream, SubscriptionRef } from 'effect';
import { TestClock } from 'effect/testing';
import type { ActualAudioInput, RecordedAudio } from '../audio';
import { type MicrophoneError, microphoneDisconnected, microphoneNoAudio } from '../errors';
import { ClipRecorder } from '../services/clip-recorder-service';
import { Microphone, type MicrophoneSession } from '../services/microphone-service';

const INPUT: ActualAudioInput = { deviceId: 'usb', label: 'USB microphone' };
const AUDIO: RecordedAudio = {
  wav: new Blob(['wav']),
  durationMs: 2000,
  signal: { capturedMs: 2000, elapsedMs: 2100, windows: [] },
};

type Fake = {
  readonly opened: string[];
  readonly closed: { count: number };
  readonly lose: (error: MicrophoneError) => void;
  readonly layer: Layer.Layer<Microphone>;
};

function closeOne(closed: { count: number }) {
  closed.count += 1;
}

function fakeMicrophone(options: { stopFails?: boolean } = {}): Fake {
  const opened: string[] = [];
  const closed = { count: 0 };
  const lost = Deferred.makeUnsafe<never, MicrophoneError>();
  const layer = Layer.effect(
    Microphone,
    Effect.gen(function* () {
      const lastInput = yield* SubscriptionRef.make<ActualAudioInput | null>(null);
      return {
        lastInput,
        open: (openOptions = {}) =>
          Effect.acquireRelease(
            Effect.sync((): MicrophoneSession => {
              opened.push(openOptions.deviceId ?? '');
              return {
                input: INPUT,
                frames: Stream.empty,
                levels: Stream.empty,
                level: Effect.succeed(0),
                noiseFloor: Effect.succeed(0),
                isWarm: Effect.succeed(true),
                warmed: Effect.void,
                lost: Deferred.await(lost),
                echoCancellationEnabled: Effect.succeed(false),
                capture: () =>
                  Effect.succeed({
                    level: Effect.succeed(0.5),
                    snapshot: () => Effect.succeed(null),
                    stop: options.stopFails
                      ? Effect.fail(microphoneNoAudio)
                      : Effect.succeed(AUDIO),
                  }),
                turns: () => Stream.empty,
                speechOnsets: () => Stream.empty,
              };
            }),
            () => Effect.sync(() => closeOne(closed)),
          ),
      };
    }),
  );
  return {
    opened,
    closed,
    lose: (error) => Deferred.doneUnsafe(lost, Effect.fail(error)),
    layer,
  };
}

function withRecorder<A, E>(
  fake: Fake,
  body: (recorder: ClipRecorder['Service']) => Effect.Effect<A, E>,
) {
  return Effect.gen(function* () {
    const recorder = yield* ClipRecorder;
    return yield* body(recorder);
  }).pipe(Effect.provide(ClipRecorder.layer.pipe(Layer.provide(fake.layer))));
}

const OPTIONS = { deviceId: 'usb', maxMs: 10_000 };

describe('clip recorder recording', () => {
  it('records on the chosen device until it is stopped and releases the microphone', async () => {
    const fake = fakeMicrophone();
    const clip = await Effect.runPromise(
      withRecorder(fake, (recorder) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(recorder.record(OPTIONS));
          yield* Effect.yieldNow;
          expect(SubscriptionRef.getUnsafe(recorder.phase).tag).toBe('recording');
          yield* recorder.stop;
          return yield* Fiber.join(fiber);
        }),
      ),
    );
    expect(fake.opened).toEqual(['usb']);
    expect(clip.durationMs).toBe(2000);
    expect(clip.input).toEqual(INPUT);
    expect(fake.closed.count).toBe(1);
  });

  it('stops by itself after the maximum length', async () => {
    const fake = fakeMicrophone();
    const clip = await Effect.runPromise(
      withRecorder(fake, (recorder) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(recorder.record(OPTIONS));
          yield* Effect.yieldNow;
          yield* TestClock.adjust(10_000);
          return yield* Fiber.join(fiber);
        }).pipe(Effect.provide(TestClock.layer())),
      ),
    );
    expect(clip.wav.size).toBeGreaterThan(0);
  });

  it('reports elapsed time and level while recording', async () => {
    const fake = fakeMicrophone();
    const phase = await Effect.runPromise(
      withRecorder(fake, (recorder) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(recorder.record(OPTIONS));
          yield* Effect.yieldNow;
          yield* TestClock.adjust(300);
          const seen = SubscriptionRef.getUnsafe(recorder.phase);
          yield* recorder.stop;
          yield* Fiber.join(fiber);
          return seen;
        }).pipe(Effect.provide(TestClock.layer())),
      ),
    );
    expect(phase.tag === 'recording' && phase.level).toBe(0.5);
    expect(phase.tag === 'recording' && phase.elapsedMs).toBeGreaterThanOrEqual(300);
  });
});

describe('clip recorder side work', () => {
  it('runs the caller work on the open capture and stops it when the recording ends', async () => {
    const fake = fakeMicrophone();
    const seen: number[] = [];
    let isRunning = false;
    const result = await Effect.runPromise(
      withRecorder(fake, (recorder) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(
            recorder.record({
              ...OPTIONS,
              whileRecording: (capture) =>
                Effect.gen(function* () {
                  seen.push(yield* capture.level);
                  isRunning = true;
                  return yield* Effect.never;
                }).pipe(Effect.ensuring(Effect.sync(() => (isRunning = false)))),
            }),
          );
          yield* Effect.yieldNow;
          yield* Effect.yieldNow;
          const wasRunning = isRunning;
          yield* recorder.stop;
          yield* Fiber.join(fiber);
          return { wasRunning, isRunningAfter: isRunning };
        }),
      ),
    );
    expect(seen).toEqual([0.5]);
    expect(result).toEqual({ wasRunning: true, isRunningAfter: false });
  });
});

describe('clip recorder failures', () => {
  it('fails with a typed error when the device is lost and releases it', async () => {
    const fake = fakeMicrophone();
    const exit = await Effect.runPromiseExit(
      withRecorder(fake, (recorder) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(recorder.record(OPTIONS));
          yield* Effect.yieldNow;
          fake.lose(microphoneDisconnected);
          return yield* Fiber.join(fiber);
        }),
      ),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    expect(fake.closed.count).toBe(1);
  });

  it('returns to idle and releases the device when the recording is interrupted', async () => {
    const fake = fakeMicrophone();
    const phase = await Effect.runPromise(
      withRecorder(fake, (recorder) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(recorder.record(OPTIONS));
          yield* Effect.yieldNow;
          yield* Fiber.interrupt(fiber);
          return SubscriptionRef.getUnsafe(recorder.phase);
        }),
      ),
    );
    expect(phase.tag).toBe('idle');
    expect(fake.closed.count).toBe(1);
  });

  it('refuses a second recording while one is running', async () => {
    const fake = fakeMicrophone();
    const exit = await Effect.runPromiseExit(
      withRecorder(fake, (recorder) =>
        Effect.gen(function* () {
          const first = yield* Effect.forkChild(recorder.record(OPTIONS));
          yield* Effect.yieldNow;
          const second = yield* Effect.exit(recorder.record(OPTIONS));
          yield* recorder.stop;
          yield* Fiber.join(first);
          return second;
        }),
      ),
    );
    expect(Exit.isSuccess(exit) && Exit.isFailure(exit.value)).toBe(true);
    expect(fake.opened).toHaveLength(1);
  });

  it('returns to idle after the capture fails to stop', async () => {
    const fake = fakeMicrophone({ stopFails: true });
    const result = await Effect.runPromise(
      withRecorder(fake, (recorder) =>
        Effect.gen(function* () {
          const fiber = yield* Effect.forkChild(recorder.record(OPTIONS));
          yield* Effect.yieldNow;
          yield* recorder.stop;
          const exit = yield* Fiber.await(fiber);
          return { exit, phase: SubscriptionRef.getUnsafe(recorder.phase) };
        }),
      ),
    );
    expect(Exit.isFailure(result.exit)).toBe(true);
    expect(result.phase.tag).toBe('idle');
  });
});
