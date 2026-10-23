import { type Cause, type Context, Effect } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { ipcFailureMessage, isTauriRuntime } from '@/core/ipc';
import { createPlayback } from '@/core/speech';
import { canTransitionPracticePhase } from '../helpers/practice-stage';
import { sessionDetailsFrom } from '../helpers/session-from-ipc';
import { PracticeSessions } from '../services/practice-session-service';
import type {
  PracticeFailure,
  PracticePhase,
  PracticeSession,
  PracticeState,
  StartOptions,
} from '../types';
import { practiceErrorAtom, practiceStateAtom } from './atoms';
import { runtime } from './runtime';

const DESKTOP_ONLY = 'Open the desktop app with bun run dev to start a conversation.';
const START_FAILED = 'Could not start practice. Please try again.';
const RESTORE_FAILED = 'Could not restore the previous conversation. Please retry.';
const FINISH_FAILED = 'Could not end practice. Please try again.';
const TRANSITION_FAILED = 'Could not move to the next practice stage. Please retry.';

type Sessions = Context.Service.Shape<typeof PracticeSessions>;
type SessionRequest = (sessions: Sessions) => Effect.Effect<PracticeSession, PracticeFailure>;

function activeStateOf(session: PracticeSession): PracticeState {
  return { tag: 'active', ...sessionDetailsFrom(session, performance.now()) };
}

function canBegin(state: PracticeState): boolean {
  return state.tag === 'idle' || state.tag === 'completed';
}

function startSession(registry: AtomRegistry.AtomRegistry, request: SessionRequest) {
  return Effect.gen(function* () {
    const previous = registry.get(practiceStateAtom);
    if (!canBegin(previous)) return;
    if (!isTauriRuntime()) {
      registry.set(practiceErrorAtom, DESKTOP_ONLY);
      return;
    }
    registry.set(practiceStateAtom, { tag: 'starting' });
    registry.set(practiceErrorAtom, '');
    const sessions = yield* PracticeSessions;
    const exit = yield* Effect.exit(request(sessions));
    if (exit._tag === 'Failure') {
      registry.set(practiceStateAtom, previous);
      registry.set(practiceErrorAtom, failureMessage(exit.cause, START_FAILED));
      return;
    }
    const playback = createPlayback(registry);
    playback.stop();
    registry.set(practiceStateAtom, activeStateOf(exit.value));
    if (activeModeIsVoice(exit.value)) playback.play(exit.value.opening_question);
  });
}

function activeModeIsVoice(session: PracticeSession): boolean {
  return (session.practice_mode ?? 'voice') === 'voice';
}

function failureMessage(cause: Cause.Cause<PracticeFailure>, fallback: string) {
  const failure = cause.reasons.flatMap((reason) =>
    reason._tag === 'Fail' ? [reason.error] : [],
  )[0];
  return failure === undefined ? fallback : ipcFailureMessage(failure, fallback);
}

export const restorePracticeAtom = Atom.keepAlive(
  runtime.atom((get) =>
    Effect.gen(function* () {
      const { registry } = get;
      if (!isTauriRuntime()) return;
      const sessions = yield* PracticeSessions;
      const exit = yield* Effect.exit(sessions.active);
      if (exit._tag === 'Failure') {
        registry.set(practiceStateAtom, { tag: 'idle' });
        registry.set(practiceErrorAtom, failureMessage(exit.cause, RESTORE_FAILED));
        return;
      }
      registry.set(
        practiceStateAtom,
        exit.value === null ? { tag: 'idle' } : activeStateOf(exit.value),
      );
    }),
  ),
);

export const startPracticeAtom = Atom.keepAlive(
  runtime.fn(
    Effect.fn('startPractice')(function* (options: StartOptions | undefined, get: Atom.FnContext) {
      yield* startSession(get.registry, (sessions) => sessions.start(options));
    }),
  ),
);

export const startMistakePracticeAtom = Atom.keepAlive(
  runtime.fn(
    Effect.fn('startMistakePractice')(function* (_: undefined, get: Atom.FnContext) {
      yield* startSession(get.registry, (sessions) => sessions.startMistakePractice);
    }),
  ),
);

export const finishPracticeAtom = Atom.keepAlive(
  runtime.fn(
    Effect.fn('finishPractice')(function* (_: undefined, get: Atom.FnContext) {
      const { registry } = get;
      const previous = registry.get(practiceStateAtom);
      if (previous.tag !== 'active') return;
      registry.set(practiceStateAtom, { ...previous, tag: 'finishing' });
      registry.set(practiceErrorAtom, '');
      const sessions = yield* PracticeSessions;
      const exit = yield* Effect.exit(sessions.finish(previous.sessionId));
      if (exit._tag === 'Failure') {
        registry.set(practiceStateAtom, previous);
        registry.set(practiceErrorAtom, failureMessage(exit.cause, FINISH_FAILED));
        return;
      }
      createPlayback(registry).stop();
      registry.set(practiceStateAtom, { tag: 'completed', summary: exit.value });
    }),
  ),
);

export const transitionPhaseAtom = Atom.keepAlive(
  runtime.fn(
    Effect.fn('transitionPhase')(function* (phase: PracticePhase, get: Atom.FnContext) {
      const { registry } = get;
      const previous = registry.get(practiceStateAtom);
      if (previous.tag !== 'active') return;
      const allowed = canTransitionPracticePhase({
        mode: previous.practiceMode,
        phase: previous.practicePhase,
        next: phase,
        writtenCount: previous.writtenTurnCount,
        spokenCount: previous.spokenTurnCount,
      });
      if (!allowed) return;
      const playback = createPlayback(registry);
      playback.stop();
      registry.set(practiceStateAtom, { ...previous, tag: 'waiting' });
      registry.set(practiceErrorAtom, '');
      const sessions = yield* PracticeSessions;
      const exit = yield* Effect.exit(sessions.transition(previous.sessionId, phase));
      if (exit._tag === 'Failure') {
        registry.set(practiceStateAtom, previous);
        registry.set(practiceErrorAtom, failureMessage(exit.cause, TRANSITION_FAILED));
        return;
      }
      registry.set(practiceStateAtom, activeStateOf(exit.value));
      if (phase === 'speaking') playback.play(exit.value.opening_question);
    }),
  ),
);
