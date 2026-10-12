import { Context, Data, Effect, Layer, Ref, type Scope } from 'effect';
import { CLOCK_POLL_MS } from '../helpers/speech-timing';
import { MODEL_SAMPLE_RATE_HZ } from '../helpers/wave-audio';

export class AudioOutputError extends Data.TaggedError('AudioOutputError')<{
  readonly stage: 'open' | 'decode' | 'schedule';
}> {}

export type ClipHandle = {
  readonly startsAtMs: number;
  readonly endsAtMs: number;
};

export type AudioSession = {
  readonly enqueue: (
    wave: ArrayBuffer,
    pauseBeforeMs: number,
  ) => Effect.Effect<ClipHandle, AudioOutputError>;
  readonly leadMs: Effect.Effect<number>;
  readonly untilStarted: (handle: ClipHandle) => Effect.Effect<void>;
  readonly untilIdle: Effect.Effect<void>;
};

export type AudioOutputShape = {
  readonly open: Effect.Effect<AudioSession, AudioOutputError, Scope.Scope>;
  readonly pause: Effect.Effect<void>;
  readonly resume: Effect.Effect<void>;
};

type SessionState = {
  readonly context: AudioContext;
  readonly queueEndS: Ref.Ref<number>;
  readonly sources: Ref.Ref<readonly AudioBufferSourceNode[]>;
};

const START_LEAD_IN_S = 0.03;
const CONTEXT_CALL_TIMEOUT_MS = 500;
const MS_PER_SECOND = 1000;

function nowMs(context: AudioContext): number {
  return context.currentTime * MS_PER_SECOND;
}

function untilClockReaches(context: AudioContext, targetMs: number): Effect.Effect<void> {
  return Effect.suspend(() =>
    nowMs(context) >= targetMs
      ? Effect.void
      : Effect.sleep(CLOCK_POLL_MS).pipe(
          Effect.flatMap(() => untilClockReaches(context, targetMs)),
        ),
  );
}

function bestEffort(run: () => Promise<unknown>): Effect.Effect<void> {
  return Effect.tryPromise({
    try: run,
    catch: () => new AudioOutputError({ stage: 'open' }),
  }).pipe(Effect.timeout(CONTEXT_CALL_TIMEOUT_MS), Effect.ignore);
}

function stopSource(source: AudioBufferSourceNode): Effect.Effect<void> {
  return Effect.try({
    try: () => {
      source.onended = null;
      source.stop();
      source.disconnect();
    },
    catch: () => new AudioOutputError({ stage: 'schedule' }),
  }).pipe(Effect.ignore);
}

function decode(context: AudioContext, wave: ArrayBuffer) {
  return Effect.tryPromise({
    try: () => context.decodeAudioData(wave.slice(0)),
    catch: () => new AudioOutputError({ stage: 'decode' }),
  });
}

function schedule(state: SessionState, buffer: AudioBuffer, pauseBeforeS: number) {
  return Effect.gen(function* () {
    const { context } = state;
    const queueEnd = yield* Ref.get(state.queueEndS);
    const startsAtS = Math.max(context.currentTime + START_LEAD_IN_S, queueEnd + pauseBeforeS);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(startsAtS);
    yield* Ref.update(state.sources, (all) => [...all, source]);
    yield* Ref.set(state.queueEndS, startsAtS + buffer.duration);
    return {
      startsAtMs: startsAtS * MS_PER_SECOND,
      endsAtMs: (startsAtS + buffer.duration) * MS_PER_SECOND,
    };
  });
}

function enqueue(state: SessionState, wave: ArrayBuffer, pauseBeforeMs: number) {
  return decode(state.context, wave).pipe(
    Effect.flatMap((buffer) => schedule(state, buffer, pauseBeforeMs / MS_PER_SECOND)),
    Effect.catchDefect(() => Effect.fail(new AudioOutputError({ stage: 'schedule' }))),
  );
}

function openSession(context: AudioContext): Effect.Effect<AudioSession, never, Scope.Scope> {
  return Effect.gen(function* () {
    const state: SessionState = {
      context,
      queueEndS: yield* Ref.make(0),
      sources: yield* Ref.make<readonly AudioBufferSourceNode[]>([]),
    };
    yield* Effect.addFinalizer(() =>
      Ref.get(state.sources).pipe(Effect.flatMap((all) => Effect.forEach(all, stopSource))),
    );
    const queueEndMs = Ref.get(state.queueEndS).pipe(Effect.map((end) => end * MS_PER_SECOND));
    return {
      enqueue: (wave, pauseBeforeMs) => enqueue(state, wave, pauseBeforeMs),
      leadMs: queueEndMs.pipe(Effect.map((end) => Math.max(0, end - nowMs(context)))),
      untilStarted: (handle) => untilClockReaches(context, handle.startsAtMs),
      untilIdle: queueEndMs.pipe(Effect.flatMap((end) => untilClockReaches(context, end))),
    };
  });
}

function contextOf(created: Ref.Ref<AudioContext | null>) {
  return Effect.gen(function* () {
    const existing = yield* Ref.get(created);
    if (existing) return existing;
    const fresh = yield* Effect.try({
      try: () => new AudioContext({ sampleRate: MODEL_SAMPLE_RATE_HZ }),
      catch: () => new AudioOutputError({ stage: 'open' }),
    });
    yield* Ref.set(created, fresh);
    return fresh;
  });
}

function withExistingContext(
  created: Ref.Ref<AudioContext | null>,
  run: (context: AudioContext) => Promise<unknown>,
): Effect.Effect<void> {
  return Ref.get(created).pipe(
    Effect.flatMap((context) => (context ? bestEffort(() => run(context)) : Effect.void)),
  );
}

export class AudioOutput extends Context.Service<AudioOutput, AudioOutputShape>()(
  'core/speech/AudioOutput',
) {
  static readonly layer = Layer.effect(
    AudioOutput,
    Effect.gen(function* () {
      const created = yield* Ref.make<AudioContext | null>(null);
      yield* Effect.addFinalizer(() => withExistingContext(created, (context) => context.close()));
      return {
        open: Effect.gen(function* () {
          const context = yield* contextOf(created);
          yield* bestEffort(() => context.resume());
          return yield* openSession(context);
        }),
        pause: withExistingContext(created, (context) => context.suspend()),
        resume: withExistingContext(created, (context) => context.resume()),
      };
    }),
  );
}
