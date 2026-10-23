import { Context, Effect, Layer, Schema } from 'effect';
import {
  FinishedSessionSchema,
  Ipc,
  IpcDecodeError,
  invokeCommand,
  PracticeSessionSchema,
} from '@/core/ipc';
import type {
  FinishedSession,
  PracticeFailure,
  PracticePhase,
  PracticeSession,
  StartOptions,
} from '../types';

type PracticeSessionsShape = {
  readonly active: Effect.Effect<PracticeSession | null, PracticeFailure>;
  readonly start: (options?: StartOptions) => Effect.Effect<PracticeSession, PracticeFailure>;
  readonly startMistakePractice: Effect.Effect<PracticeSession, PracticeFailure>;
  readonly transition: (
    sessionId: number,
    phase: PracticePhase,
  ) => Effect.Effect<PracticeSession, PracticeFailure>;
  readonly finish: (sessionId: number) => Effect.Effect<FinishedSession, PracticeFailure>;
  readonly setClock: (
    sessionId: number,
    running: boolean,
  ) => Effect.Effect<PracticeSession, PracticeFailure>;
};

const NullableSession = Schema.NullOr(PracticeSessionSchema);

function mismatch(command: string, expected: number) {
  return new IpcDecodeError({ command, cause: `expected session ${expected}` });
}

function forSession(command: string, sessionId: number) {
  return (session: PracticeSession) =>
    session.session_id === sessionId
      ? Effect.succeed(session)
      : Effect.fail(mismatch(command, sessionId));
}

export class PracticeSessions extends Context.Service<PracticeSessions, PracticeSessionsShape>()(
  'core/practice-session/PracticeSessions',
) {
  static readonly layer = Layer.effect(
    PracticeSessions,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        active: Effect.suspend(() =>
          invokeCommand(ipc, 'get_active_practice_session', NullableSession),
        ),
        start: (options) =>
          invokeCommand(
            ipc,
            'start_practice_session',
            PracticeSessionSchema,
            options === undefined ? undefined : { options },
          ),
        startMistakePractice: Effect.suspend(() =>
          invokeCommand(ipc, 'start_mistake_practice', PracticeSessionSchema),
        ),
        transition: (sessionId, phase) =>
          invokeCommand(ipc, 'transition_practice_phase', PracticeSessionSchema, {
            sessionId,
            phase,
          }).pipe(Effect.flatMap(forSession('transition_practice_phase', sessionId))),
        finish: (sessionId) =>
          invokeCommand(ipc, 'finish_practice_session', FinishedSessionSchema, { sessionId }).pipe(
            Effect.filterOrFail(
              (summary) => summary.session_id === sessionId,
              () => mismatch('finish_practice_session', sessionId),
            ),
          ),
        setClock: (sessionId, running) =>
          invokeCommand(ipc, 'set_practice_clock', PracticeSessionSchema, {
            sessionId,
            running,
          }).pipe(Effect.flatMap(forSession('set_practice_clock', sessionId))),
      };
    }),
  );
}
