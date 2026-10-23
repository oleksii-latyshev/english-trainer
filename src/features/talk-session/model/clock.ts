import { Duration, Effect, Semaphore } from 'effect';
import { AsyncResult, Atom, type AtomRegistry } from 'effect/reactivity';
import { microphoneSnapshotAtom } from '@/core/audio';
import { ipcFailureMessage } from '@/core/ipc';
import {
  applyClockSnapshot,
  isClockedStage,
  isSpokenStage,
  PracticeSessions,
  practiceErrorAtom,
  practiceSessionRuntime,
  practiceStateAtom,
  reportPracticeError,
} from '@/core/practice-session';

const CHECKPOINT_EVERY = Duration.seconds(15);
const CLOCK_FAILED = 'Session time could not be saved. Keep the app open and try again.';

const checkpoints = Semaphore.makeUnsafe(1);
const clockErrorAtom = Atom.make(false);

const clockedSessionIdAtom = Atom.make((get) => {
  const state = get(practiceStateAtom);
  const isOpen = state.tag === 'active' || state.tag === 'waiting';
  return isOpen && isClockedStage(state) ? state.sessionId : undefined;
});

const isMicrophonePausedAtom = Atom.make((get) => {
  const state = get(practiceStateAtom);
  const snapshot = AsyncResult.getOrElse(get(microphoneSnapshotAtom), () => null);
  const isSpoken = (state.tag === 'active' || state.tag === 'waiting') && isSpokenStage(state);
  return isSpoken && snapshot?.status === 'paused';
});

function checkpoint(
  registry: AtomRegistry.AtomRegistry,
  sessions: PracticeSessions['Service'],
  sessionId: number,
  running: boolean,
) {
  return sessions.setClock(sessionId, running).pipe(
    Effect.tap((session) =>
      Effect.sync(() => {
        applyClockSnapshot(registry, session);
        if (!registry.get(clockErrorAtom)) return;
        registry.set(clockErrorAtom, false);
        registry.set(practiceErrorAtom, '');
      }),
    ),
    Effect.catch((failure) =>
      Effect.sync(() => {
        registry.set(clockErrorAtom, true);
        reportPracticeError(registry, ipcFailureMessage(failure, CLOCK_FAILED));
      }),
    ),
    Effect.asVoid,
    checkpoints.withPermits(1),
  );
}

export const sessionClockAtom = practiceSessionRuntime.atom((get) => {
  const sessionId = get(clockedSessionIdAtom);
  const isPaused = get(isMicrophonePausedAtom);
  if (sessionId === undefined) return Effect.void;
  const openSessionId: number = sessionId;
  return Effect.gen(function* () {
    const sessions = yield* PracticeSessions;
    function report(running: boolean) {
      return checkpoint(get.registry, sessions, openSessionId, running);
    }
    yield* Effect.addFinalizer(() => report(false));
    yield* report(!isPaused);
    if (isPaused) return;
    return yield* Effect.forever(Effect.sleep(CHECKPOINT_EVERY).pipe(Effect.andThen(report(true))));
  });
});
