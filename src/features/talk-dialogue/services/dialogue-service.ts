import { Context, Effect, Layer, Stream } from 'effect';
import {
  COACHING_UPDATED_EVENT,
  CoachingUpdatedSchema,
  Ipc,
  IpcDecodeError,
  IpcEvents,
  invokeCommand,
  PracticeDialogueSchema,
} from '@/core/ipc';
import type { DialogueFailure, PracticeDialogue } from '../types';

type DialogueServiceShape = {
  readonly read: (sessionId: number) => Effect.Effect<PracticeDialogue, DialogueFailure>;
  readonly coachingUpdates: (sessionId: number) => Stream.Stream<void>;
};

export class DialogueService extends Context.Service<DialogueService, DialogueServiceShape>()(
  'features/talk-dialogue/DialogueService',
) {
  static readonly layer = Layer.effect(
    DialogueService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      const events = yield* IpcEvents;
      return {
        read: (sessionId) =>
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
        coachingUpdates: (sessionId) =>
          events.listen(COACHING_UPDATED_EVENT, CoachingUpdatedSchema).pipe(
            Stream.filter((event) => event.session_id === sessionId),
            Stream.map(() => undefined),
          ),
      };
    }),
  );
}
