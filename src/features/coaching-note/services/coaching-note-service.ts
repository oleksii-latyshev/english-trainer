import { Context, Effect, Layer, Stream } from 'effect';
import {
  AttemptComparisonSchema,
  COACHING_UPDATED_EVENT,
  CoachingUpdatedSchema,
  Ipc,
  IpcDecodeError,
  IpcEvents,
  invokeCommand,
  invokeUnitCommand,
  PracticeDialogueSchema,
} from '@/core/ipc';
import type { AttemptComparison, CoachingNoteFailure, ReviewedConversation } from '../types';

type CoachingNoteServiceShape = {
  readonly readConversation: (
    sessionId: number,
  ) => Effect.Effect<ReviewedConversation, CoachingNoteFailure>;
  readonly compareSecondTry: (
    sessionId: number,
    sequence: number,
    transcript: string,
  ) => Effect.Effect<AttemptComparison, CoachingNoteFailure>;
  readonly coachingUpdates: (sessionId: number) => Stream.Stream<void>;
  readonly retryCoaching: (
    sessionId: number,
    sequence: number,
  ) => Effect.Effect<void, CoachingNoteFailure>;
};

export class CoachingNoteService extends Context.Service<
  CoachingNoteService,
  CoachingNoteServiceShape
>()('features/coaching-note/CoachingNoteService') {
  static readonly layer = Layer.effect(
    CoachingNoteService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      const events = yield* IpcEvents;
      return {
        readConversation: (sessionId) =>
          invokeCommand(ipc, 'get_practice_dialogue', PracticeDialogueSchema, { sessionId }).pipe(
            Effect.filterOrFail(
              (dialogue) => dialogue.session_id === sessionId,
              () =>
                new IpcDecodeError({
                  command: 'get_practice_dialogue',
                  cause: `expected session ${sessionId}`,
                }),
            ),
          ),
        compareSecondTry: (sessionId, sequence, transcript) =>
          invokeCommand(ipc, 'retry_practice_turn', AttemptComparisonSchema, {
            sessionId,
            sequence,
            transcript,
          }).pipe(
            Effect.filterOrFail(
              (comparison) => comparison.turn_sequence === sequence,
              () =>
                new IpcDecodeError({
                  command: 'retry_practice_turn',
                  cause: `expected answer ${sequence}`,
                }),
            ),
          ),
        coachingUpdates: (sessionId) =>
          events.listen(COACHING_UPDATED_EVENT, CoachingUpdatedSchema).pipe(
            Stream.filter((event) => event.session_id === sessionId),
            Stream.map(() => undefined),
          ),
        retryCoaching: (sessionId, sequence) =>
          invokeUnitCommand(ipc, 'retry_answer_coaching', { sessionId, sequence }),
      };
    }),
  );
}
