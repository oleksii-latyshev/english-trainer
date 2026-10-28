import { Deferred, Duration, Effect, Ref, Stream } from 'effect';
import type { Atom, AtomRegistry } from 'effect/reactivity';
import { MicrophoneError } from '@/core/audio';
import { conversationFlowAtom } from '@/core/conversation-flow';
import { createSpeechGate, liveTranscript } from '@/core/speech';
import { preRollMsFor } from '../helpers/capture-state';
import { AnswerRecorder, type OpenedAnswer } from '../services/answer-recorder-service';
import type { CaptureState, ListenRequest } from '../types';
import { captureControlAtom, captureStateAtom, captureTimingAtom, turnHeldOpenAtom } from './state';

const LEVEL_TICK = Duration.millis(100);
const AUTO_LISTEN_IDLE_MS = 20_000;
const AUTO_SETTLE_MS = 300;
const DISCONNECTED_DURING_RECORDING =
  'The microphone disconnected during recording. Reconnect it and try again.';

type Verdict = 'stop' | 'cancel';

type Watch = {
  readonly registry: AtomRegistry.AtomRegistry;
  readonly request: ListenRequest;
  readonly opened: OpenedAnswer;
  readonly stopped: Deferred.Deferred<Verdict>;
  readonly heard: Ref.Ref<boolean>;
  readonly startedAtMs: number;
};

function updateRecording(
  registry: AtomRegistry.AtomRegistry,
  change: (state: Extract<CaptureState, { tag: 'recording' }>) => CaptureState,
) {
  registry.update(captureStateAtom, (state) => (state.tag === 'recording' ? change(state) : state));
}

function trackLevel(watch: Watch, gate: ReturnType<typeof createSpeechGate>) {
  const { registry, opened } = watch;
  return Effect.forever(
    Effect.sleep(LEVEL_TICK).pipe(
      Effect.andThen(opened.capture.level),
      Effect.flatMap((level) =>
        Effect.gen(function* () {
          gate.sample(level);
          const heardWithoutDetector = opened.turns === null && gate.hasHeardSpeech();
          if (heardWithoutDetector) yield* Ref.set(watch.heard, true);
          updateRecording(registry, (state) => ({
            ...state,
            elapsedMs: performance.now() - watch.startedAtMs,
            level,
            heardSpeech: state.heardSpeech || heardWithoutDetector,
          }));
        }),
      ),
    ),
  );
}

function trackLiveText(watch: Watch) {
  const { registry, opened } = watch;
  return liveTranscript({
    window: opened.capture.window,
    hasHeardSpeech: Ref.get(watch.heard),
  }).pipe(
    Stream.runForEach((liveText) =>
      Effect.sync(() => updateRecording(registry, (state) => ({ ...state, liveText }))),
    ),
  );
}

function watchTurns(watch: Watch, hold: Ref.Ref<boolean>) {
  const { registry, opened } = watch;
  const flow = registry.get(conversationFlowAtom);
  const turns = opened.turns;
  if (turns === null) return Effect.void;
  return turns({
    endPauseMs: flow.endPauseMs,
    settleMs: watch.request.mode === 'auto' ? AUTO_SETTLE_MS : 0,
    hold,
  }).pipe(
    Stream.runForEach((event) =>
      event._tag === 'SpeechStarted'
        ? Effect.andThen(
            Ref.set(watch.heard, true),
            Effect.sync(() =>
              updateRecording(registry, (state) => ({ ...state, heardSpeech: true })),
            ),
          )
        : Effect.sync(() => {
            if (registry.get(conversationFlowAtom).handsFree) {
              Deferred.doneUnsafe(watch.stopped, Effect.succeed('stop'));
            }
          }),
    ),
  );
}

function idleWhileNotHeld(get: Atom.FnContext) {
  return Effect.callback<void>((resume) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function disarm() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    }
    get.subscribe(
      turnHeldOpenAtom,
      (isHeld) => {
        disarm();
        if (!isHeld) timer = setTimeout(() => resume(Effect.void), AUTO_LISTEN_IDLE_MS);
      },
      { immediate: true },
    );
    return Effect.sync(disarm);
  });
}

function abandonWhenIdle(get: Atom.FnContext, watch: Watch) {
  return idleWhileNotHeld(get).pipe(
    Effect.andThen(Ref.get(watch.heard)),
    Effect.flatMap((heard) =>
      heard
        ? Effect.void
        : Effect.sync(() => Deferred.doneUnsafe(watch.stopped, Effect.succeed('cancel'))),
    ),
  );
}

function lostDuringRecording(opened: OpenedAnswer) {
  return opened.lost.pipe(
    Effect.mapError(
      () => new MicrophoneError({ reason: 'disconnected', message: DISCONNECTED_DURING_RECORDING }),
    ),
  );
}

export function recordTurn(get: Atom.FnContext, request: ListenRequest, requestedAtMs: number) {
  const { registry } = get;
  return Effect.scoped(
    Effect.gen(function* () {
      const recorder = yield* AnswerRecorder;
      const opened = yield* recorder.open({
        preRollMs: preRollMsFor(request.mode, request.discardPreRoll),
      });
      const startedAtMs = performance.now();
      const stopped = yield* Deferred.make<Verdict>();
      const heard = yield* Ref.make(false);
      const hold = yield* Ref.make(false);
      const watch: Watch = { registry, request, opened, stopped, heard, startedAtMs };
      registry.set(captureControlAtom, {
        stopped,
        capture: opened.capture,
        watchesTurns: opened.turns !== null,
      });
      yield* Effect.addFinalizer(() => Effect.sync(() => registry.set(captureControlAtom, null)));
      registry.set(captureTimingAtom, { captureStartMs: startedAtMs - requestedAtMs });
      registry.set(captureStateAtom, {
        tag: 'recording',
        elapsedMs: 0,
        level: 0,
        mode: request.mode,
        held: false,
        heardSpeech: false,
        liveText: '',
        actualInput: opened.input,
      });
      yield* Effect.forkScoped(trackLevel(watch, createSpeechGate()));
      yield* Effect.forkScoped(trackLiveText(watch));
      yield* Effect.forkScoped(
        Stream.runForEach(get.stream(turnHeldOpenAtom), (held) => Ref.set(hold, held)),
      );
      if (opened.turns !== null) yield* Effect.forkScoped(watchTurns(watch, hold));
      if (request.mode === 'auto' && opened.turns !== null) {
        yield* Effect.forkScoped(abandonWhenIdle(get, watch));
      }
      const verdict = yield* Effect.raceFirst(Deferred.await(stopped), lostDuringRecording(opened));
      if (verdict === 'cancel') return null;
      const speechStoppedAtMs = performance.now();
      registry.update(captureStateAtom, (state) =>
        state.tag === 'recording'
          ? { ...state, tag: 'stopping' as const, level: 0, held: false, liveText: '' }
          : state,
      );
      const [elapsed, audio] = yield* Effect.timed(opened.capture.stop);
      registry.update(captureTimingAtom, (timing) => ({
        ...timing,
        captureFinalizationMs: Duration.toMillis(elapsed),
      }));
      return { audio, speechStoppedAtMs };
    }),
  );
}
