import { Deferred, Effect, Exit, Fiber, Ref, Scope, Stream } from 'effect';
import {
  type ActualAudioInput,
  type AudioServices,
  audioRuntime,
  type Capture,
  type CaptureOptions,
  MIC_DISCONNECTED_MESSAGE,
  type MicrophoneSession,
  type RecordedAudio,
  type WarmSlot,
} from '@/core/audio';
import { settle, settleSync } from './settle';

export type MicrophoneCapture = {
  readonly capture: Capture;
  readonly snapshot: (options?: { tailMs: number }) => Promise<Blob | null>;
  readonly stop: () => Promise<RecordedAudio>;
  readonly cancel: () => void;
  readonly level: () => number;
};

export type TurnListeningOptions = {
  readonly endPauseMs: number;
  readonly settleMs?: number;
};

export type TurnHandlers = {
  readonly onSpeechStarted: () => void;
  readonly onTurnEnded: () => void;
};

export type TurnListening = {
  readonly setHold: (held: boolean) => void;
  readonly dispose: () => void;
};

export type BeginCaptureOptions = CaptureOptions & {
  readonly onDeviceLost?: () => void;
};

export type WarmSession = {
  readonly opened: Promise<ActualAudioInput>;
  readonly echoCancellationEnabled: () => boolean;
  readonly listenForTurn: (options: TurnListeningOptions, handlers: TurnHandlers) => TurnListening;
  readonly subscribeLevels: (listener: (level: number) => void) => () => void;
  readonly subscribeSpeechOnsets: (
    options: { readonly isEnabled: boolean },
    handler: () => void,
  ) => () => void;
  readonly beginCapture: (options?: BeginCaptureOptions) => MicrophoneCapture;
};

const handles = new WeakMap<WarmSlot, WarmSession>();

function beginOrRelease<A>(
  begin: Effect.Effect<A, unknown, AudioServices>,
  release: () => void,
): A {
  try {
    return settleSync(begin);
  } catch (error) {
    release();
    throw error;
  }
}

export function captureOnSession(
  session: MicrophoneSession,
  options: BeginCaptureOptions,
): MicrophoneCapture {
  const scope = audioRuntime.runSync(Scope.make());
  function closeScope() {
    audioRuntime.runFork(Scope.close(scope, Exit.void));
  }
  const begin = Effect.gen(function* () {
    const capture = yield* session.capture({ preRollMs: options.preRollMs });
    const { onDeviceLost } = options;
    if (onDeviceLost) {
      yield* Effect.forkScoped(
        session.lost.pipe(
          Effect.catch(() => Effect.sync(onDeviceLost)),
          Effect.ignore,
        ),
      );
    }
    return capture;
  }).pipe(Scope.provide(scope));
  const capture = beginOrRelease(begin, closeScope);
  return {
    capture,
    level: () => settleSync(capture.level),
    snapshot: (snapshotOptions) => settle(capture.snapshot(snapshotOptions)),
    stop: async () => {
      try {
        return await settle(capture.stop);
      } finally {
        closeScope();
      }
    },
    cancel: closeScope,
  };
}

function watchStream<A>(stream: Stream.Stream<A>, onValue: (value: A) => void): () => void {
  const fiber = audioRuntime.runFork(
    Stream.runForEach(stream, (value) => Effect.sync(() => onValue(value))),
  );
  return () => {
    audioRuntime.runFork(Fiber.interrupt(fiber));
  };
}

export function listenOnSession(
  session: MicrophoneSession,
  options: TurnListeningOptions,
  handlers: TurnHandlers,
): TurnListening {
  const hold = Ref.makeUnsafe(false);
  const dispose = watchStream(
    session.turns({ endPauseMs: options.endPauseMs, settleMs: options.settleMs, hold }),
    (event) => {
      if (event._tag === 'SpeechStarted') handlers.onSpeechStarted();
      else handlers.onTurnEnded();
    },
  );
  return {
    setHold: (held) => {
      audioRuntime.runSync(Ref.set(hold, held));
    },
    dispose,
  };
}

function readySession(slot: WarmSlot): MicrophoneSession | null {
  if (!Deferred.isDoneUnsafe(slot.session)) return null;
  const exit = audioRuntime.runSyncExit(Deferred.await(slot.session));
  return Exit.isSuccess(exit) ? exit.value : null;
}

export function warmSessionOf(slot: WarmSlot): WarmSession {
  const cached = handles.get(slot);
  if (cached) return cached;
  const opened = settle(Effect.map(Deferred.await(slot.session), (session) => session.input));
  opened.catch(() => undefined);
  const handle: WarmSession = {
    opened,
    echoCancellationEnabled: () => {
      const ready = readySession(slot);
      return ready ? settleSync(ready.echoCancellationEnabled) : false;
    },
    listenForTurn: (options, handlers) => {
      const ready = readySession(slot);
      if (!ready) throw new Error(MIC_DISCONNECTED_MESSAGE);
      return listenOnSession(ready, options, handlers);
    },
    subscribeLevels: (listener) => {
      const ready = readySession(slot);
      return ready ? watchStream(ready.levels, listener) : () => undefined;
    },
    subscribeSpeechOnsets: (options, handler) => {
      const ready = readySession(slot);
      if (!ready) return () => undefined;
      return watchStream(
        ready.speechOnsets({ isEnabled: Effect.sync(() => options.isEnabled) }),
        handler,
      );
    },
    beginCapture: (options = {}) => {
      const ready = readySession(slot);
      if (!ready) throw new Error(MIC_DISCONNECTED_MESSAGE);
      return captureOnSession(ready, options);
    },
  };
  handles.set(slot, handle);
  return handle;
}
