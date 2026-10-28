import { describe, expect, it } from 'bun:test';
import { Effect, Exit, Fiber, Scope, Stream } from 'effect';
import { TestClock } from 'effect/testing';
import { MAX_PRE_ROLL_MS, STARTUP_TIMEOUT_MS } from '../audio';
import { makeCaptureEngine } from '../services/capture-engine';
import { identityResample, SAMPLE_RATE_HZ, tone } from './fakes';

const WARM_UP_SAMPLES = SAMPLE_RATE_HZ * 3;

function withEngine<A, E>(
  use: (
    engine: Effect.Success<ReturnType<typeof makeCaptureEngine>>,
  ) => Effect.Effect<A, E, Scope.Scope>,
) {
  return Effect.scoped(
    makeCaptureEngine({ sampleRateHz: SAMPLE_RATE_HZ, resample: identityResample }).pipe(
      Effect.flatMap(use),
    ),
  ).pipe(Effect.provide(TestClock.layer()), Effect.runPromise);
}

function warmUp(engine: Effect.Success<ReturnType<typeof makeCaptureEngine>>) {
  return Effect.sync(() => {
    for (let ms = 0; ms < 3000; ms += 100) engine.ingest(tone(100, 0.001));
  });
}

describe('capture engine', () => {
  it('is warm only after three seconds of input', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        engine.ingest(tone(WARM_UP_SAMPLES - 1));
        expect(yield* engine.isWarm).toBe(false);
        engine.ingest(tone(1));
        expect(yield* engine.isWarm).toBe(true);
        yield* engine.warmed;
      }),
    ));

  it('fails as not ready when the input never warms up in time', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        yield* engine.armStartupTimeout;
        const lost = yield* Effect.forkChild(Effect.flip(engine.lost));
        yield* TestClock.adjust(STARTUP_TIMEOUT_MS);
        const error = yield* Fiber.join(lost);
        expect(error.reason).toBe('not-ready');
        const warmed = yield* Effect.flip(engine.warmed);
        expect(warmed.reason).toBe('not-ready');
      }),
    ));

  it('keeps the startup timer quiet once the input warmed up', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        yield* engine.armStartupTimeout;
        const lost = yield* Effect.forkChild(Effect.exit(engine.lost));
        yield* warmUp(engine);
        yield* TestClock.adjust(STARTUP_TIMEOUT_MS * 2);
        expect(lost.pollUnsafe()).toBeUndefined();
        expect(yield* engine.isWarm).toBe(true);
      }),
    ));

  it('starts a capture with the requested pre-roll and clamps it', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        yield* warmUp(engine);
        engine.ingest(tone(MAX_PRE_ROLL_MS * 2, 0.2));
        const scope = yield* Scope.make();
        const capture = yield* engine.capture({ preRollMs: 10_000 }).pipe(Scope.provide(scope));
        const recorded = yield* capture.stop;
        expect(recorded.signal.capturedMs).toBe(MAX_PRE_ROLL_MS);
        yield* Scope.close(scope, Exit.void);
      }),
    ));
});

describe('capture engine captures', () => {
  it('captures only what arrives after start when there is no pre-roll', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        yield* warmUp(engine);
        engine.ingest(tone(200));
        const capture = yield* engine.capture({ preRollMs: 0 });
        engine.ingest(tone(100));
        engine.ingest(tone(50));
        const recorded = yield* capture.stop;
        expect(recorded.signal.capturedMs).toBe(150);
      }),
    ));

  it('fails to stop an empty capture', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        const capture = yield* engine.capture();
        const error = yield* Effect.flip(capture.stop);
        expect(error.reason).toBe('no-audio');
      }),
    ));

  it('keeps producing windows from an absolute offset after the capture passes 30 s', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        const capture = yield* engine.capture();
        expect(yield* capture.window(0)).toBeNull();
        engine.ingest(tone(40_000));
        expect(yield* capture.snapshot()).toBeNull();
        const tail = yield* capture.window(25_000);
        expect(tail?.wav.size).toBe(44 + 15_000 * 2);
        expect(tail?.endMs).toBe(40_000);
        const capped = yield* capture.window(0);
        expect(capped?.wav.size).toBe(44 + 30_000 * 2);
        expect(yield* capture.window(40_000)).toBeNull();
      }),
    ));

  it('snapshots the audio so far and limits it to a tail', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        const capture = yield* engine.capture();
        expect(yield* capture.snapshot()).toBeNull();
        engine.ingest(tone(1000));
        const whole = yield* capture.snapshot();
        const tail = yield* capture.snapshot({ tailMs: 500 });
        expect(whole?.size).toBe(44 + 1000 * 2);
        expect(tail?.size).toBe(44 + 500 * 2);
      }),
    ));

  it('stops delivering to a capture whose scope closed', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        const scope = yield* Scope.make();
        const capture = yield* engine.capture().pipe(Scope.provide(scope));
        engine.ingest(tone(100));
        yield* Scope.close(scope, Exit.void);
        engine.ingest(tone(100));
        expect(yield* capture.snapshot()).toBeNull();
      }),
    ));

  it('refuses a capture after the device was lost and reports the loss', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        engine.fail({ reason: 'disconnected', message: 'gone' } as never);
        const refused = yield* Effect.flip(engine.capture());
        expect(refused.reason).toBe('disconnected');
      }),
    ));

  it('delivers frames with their level to subscribers', () =>
    withEngine((engine) =>
      Effect.gen(function* () {
        const collected = yield* Effect.forkChild(
          engine.frames.pipe(Stream.take(2), Stream.runCollect),
        );
        yield* Effect.yieldNow;
        engine.ingest(tone(100, 0.5));
        engine.ingest(tone(100, 0.25));
        const frames = yield* Fiber.join(collected);
        expect(frames.map((frame) => frame.rms)).toEqual([0.5, 0.25]);
        expect(frames[0]?.durationMs).toBe(100);
      }),
    ));
});
