import { Clock, Deferred, Effect, PubSub, type Scope, Stream } from 'effect';
import {
  type AudioFrame,
  MAX_PRE_ROLL_MS,
  MAX_SNAPSHOT_MS,
  type RecordedAudio,
  STARTUP_TIMEOUT_MS,
  WHISPER_SAMPLE_RATE_HZ,
} from '../audio';
import {
  type MicrophoneError,
  microphoneDisconnected,
  microphoneNoAudio,
  microphoneNotReady,
} from '../errors';
import { measureAudioLevel, signalMeterValue, summarizeAudioSignal } from '../helpers/audio-signal';
import { snapshotAudioChunks } from '../helpers/audio-tail';
import { createCaptureStartup } from '../helpers/capture-startup';
import { encodeWav } from '../helpers/pcm-encoding';
import { createPreRollBuffer } from '../helpers/pre-roll-buffer';
import { createNoiseFloorTracker } from '../helpers/turn-detector';
import type { Resample } from './whisper-resampler';

const FRAME_BACKLOG = 512;
const MS_PER_SECOND = 1000;

export type CaptureOptions = {
  readonly preRollMs?: number;
};

export type Capture = {
  readonly level: Effect.Effect<number>;
  readonly snapshot: (options?: {
    readonly tailMs: number;
  }) => Effect.Effect<Blob | null, MicrophoneError>;
  readonly stop: Effect.Effect<RecordedAudio, MicrophoneError>;
};

export type CaptureEngine = {
  readonly frames: Stream.Stream<AudioFrame>;
  readonly ingest: (samples: Float32Array) => void;
  readonly fail: (error: MicrophoneError) => void;
  readonly level: Effect.Effect<number>;
  readonly noiseFloor: Effect.Effect<number>;
  readonly isWarm: Effect.Effect<boolean>;
  readonly warmed: Effect.Effect<void, MicrophoneError>;
  readonly lost: Effect.Effect<never, MicrophoneError>;
  readonly armStartupTimeout: Effect.Effect<void, never, Scope.Scope>;
  readonly capture: (
    options?: CaptureOptions,
  ) => Effect.Effect<Capture, MicrophoneError, Scope.Scope>;
};

type ActiveCapture = {
  chunks: Float32Array[];
  sampleCount: number;
  readonly startedAtMs: number;
  readonly preRollMs: number;
};

type EngineOptions = {
  readonly sampleRateHz: number;
  readonly resample: Resample;
};

type EngineState = {
  closed: boolean;
  failed: boolean;
  warm: boolean;
  level: number;
  active: ActiveCapture | null;
};

type EngineContext = EngineOptions & {
  readonly state: EngineState;
  readonly frames: PubSub.PubSub<AudioFrame>;
  readonly warmed: Deferred.Deferred<void, MicrophoneError>;
  readonly lost: Deferred.Deferred<never, MicrophoneError>;
  readonly startup: ReturnType<typeof createCaptureStartup>;
  readonly noise: ReturnType<typeof createNoiseFloorTracker>;
  readonly preRoll: ReturnType<typeof createPreRollBuffer>;
};

function sampleTotal(chunks: Float32Array[]): number {
  return chunks.reduce((total, chunk) => total + chunk.length, 0);
}

function failEngine(context: EngineContext, error: MicrophoneError) {
  const { state } = context;
  if (state.closed || state.failed) return;
  state.failed = true;
  Deferred.doneUnsafe(context.warmed, Effect.fail(error));
  Deferred.doneUnsafe(context.lost, Effect.fail(error));
}

function ingestSamples(context: EngineContext, samples: Float32Array) {
  const { state, sampleRateHz } = context;
  if (state.closed) return;
  const durationMs = (samples.length / sampleRateHz) * MS_PER_SECOND;
  const rms = measureAudioLevel(samples).rms;
  state.level = signalMeterValue(rms);
  if (state.warm) {
    context.noise.update(rms, durationMs);
  } else if (context.startup.accept(samples.length)) {
    state.warm = true;
    Deferred.doneUnsafe(context.warmed, Effect.void);
  }
  context.preRoll.push(samples);
  if (state.active) {
    state.active.chunks.push(samples);
    state.active.sampleCount += samples.length;
  }
  PubSub.publishUnsafe(context.frames, { samples, rms, durationMs });
}

function detach(context: EngineContext, active: ActiveCapture) {
  if (context.state.active === active) context.state.active = null;
}

function release(context: EngineContext, active: ActiveCapture) {
  detach(context, active);
  active.chunks = [];
  active.sampleCount = 0;
}

function snapshotOf(
  context: EngineContext,
  active: ActiveCapture,
  options?: { readonly tailMs: number },
) {
  const { sampleRateHz } = context;
  return Effect.gen(function* () {
    if (context.state.active !== active || active.sampleCount === 0) return null;
    const durationMs = (active.sampleCount / sampleRateHz) * MS_PER_SECOND;
    if (!options && durationMs > MAX_SNAPSHOT_MS) return null;
    const chunks = snapshotAudioChunks(active.chunks, sampleRateHz, options?.tailMs);
    const resampled = yield* context.resample(chunks, sampleTotal(chunks), sampleRateHz);
    return encodeWav([resampled], resampled.length, WHISPER_SAMPLE_RATE_HZ);
  });
}

function stopOf(context: EngineContext, active: ActiveCapture) {
  const { sampleRateHz } = context;
  return Effect.gen(function* () {
    detach(context, active);
    const nowMs = yield* Clock.currentTimeMillis;
    const elapsedMs = nowMs - active.startedAtMs + active.preRollMs;
    if (active.sampleCount === 0) return yield* microphoneNoAudio;
    const resampled = yield* context.resample(active.chunks, active.sampleCount, sampleRateHz);
    const signal = summarizeAudioSignal(active.chunks, sampleRateHz, elapsedMs);
    active.chunks = [];
    return {
      wav: encodeWav([resampled], resampled.length, WHISPER_SAMPLE_RATE_HZ),
      durationMs: Math.round((resampled.length / WHISPER_SAMPLE_RATE_HZ) * MS_PER_SECOND),
      signal,
    };
  });
}

function captureOf(context: EngineContext, active: ActiveCapture): Capture {
  return {
    level: Effect.sync(() => context.state.level),
    snapshot: (options) => snapshotOf(context, active, options),
    stop: stopOf(context, active),
  };
}

function startCapture(context: EngineContext, options: CaptureOptions) {
  const { state, sampleRateHz } = context;
  return Effect.gen(function* () {
    if (state.closed || state.failed) return yield* microphoneDisconnected;
    const preRollMs = Math.max(0, Math.min(MAX_PRE_ROLL_MS, options.preRollMs ?? 0));
    const chunks = context.preRoll.snapshot(Math.floor((sampleRateHz * preRollMs) / MS_PER_SECOND));
    const startedAtMs = yield* Clock.currentTimeMillis;
    const active: ActiveCapture = {
      chunks,
      sampleCount: sampleTotal(chunks),
      startedAtMs,
      preRollMs,
    };
    state.active = active;
    yield* Effect.addFinalizer(() => Effect.sync(() => release(context, active)));
    return captureOf(context, active);
  });
}

function armStartupTimeout(context: EngineContext) {
  return Effect.forkScoped(
    Deferred.await(context.warmed).pipe(
      Effect.timeoutOrElse({
        duration: STARTUP_TIMEOUT_MS,
        orElse: () => Effect.sync(() => failEngine(context, microphoneNotReady)),
      }),
      Effect.ignore,
    ),
  ).pipe(Effect.asVoid);
}

function makeContext(options: EngineOptions) {
  return Effect.gen(function* () {
    const { sampleRateHz } = options;
    const frames = yield* PubSub.sliding<AudioFrame>(FRAME_BACKLOG);
    const context: EngineContext = {
      ...options,
      frames,
      state: { closed: false, failed: false, warm: false, level: 0, active: null },
      warmed: yield* Deferred.make<void, MicrophoneError>(),
      lost: yield* Deferred.make<never, MicrophoneError>(),
      startup: createCaptureStartup(sampleRateHz),
      noise: createNoiseFloorTracker(),
      preRoll: createPreRollBuffer(Math.ceil((sampleRateHz * MAX_PRE_ROLL_MS) / MS_PER_SECOND)),
    };
    return context;
  });
}

function shutdown(context: EngineContext) {
  return Effect.gen(function* () {
    context.state.closed = true;
    context.state.active = null;
    context.preRoll.clear();
    Deferred.doneUnsafe(context.warmed, Effect.fail(microphoneDisconnected));
    yield* PubSub.shutdown(context.frames);
  });
}

export function makeCaptureEngine(options: EngineOptions) {
  return Effect.gen(function* () {
    const context = yield* makeContext(options);
    yield* Effect.addFinalizer(() => shutdown(context));
    const engine: CaptureEngine = {
      frames: Stream.fromPubSub(context.frames),
      ingest: (samples) => ingestSamples(context, samples),
      fail: (error) => failEngine(context, error),
      level: Effect.sync(() => context.state.level),
      noiseFloor: Effect.sync(() => context.noise.value()),
      isWarm: Effect.sync(() => context.state.warm),
      warmed: Deferred.await(context.warmed),
      lost: Deferred.await(context.lost),
      armStartupTimeout: armStartupTimeout(context),
      capture: (captureOptions = {}) => startCapture(context, captureOptions),
    };
    return engine;
  });
}
