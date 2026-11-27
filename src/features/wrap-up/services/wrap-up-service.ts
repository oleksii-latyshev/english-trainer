import { Context, Effect, Layer, Option, Stream } from 'effect';
import {
  COACHING_UPDATED_EVENT,
  CoachingUpdatedSchema,
  FinishedSessionSchema,
  Ipc,
  IpcDecodeError,
  IpcEvents,
  invokeCommand,
  PhraseCardRecordSchema,
  WRAPUP_UPDATED_EVENT,
  WrapupUpdatedSchema,
} from '@/core/ipc';
import type { FinishedSession, PhraseCard, TakenWord, WrapUpFailure } from '../types';

type WrapUpServiceShape = {
  readonly read: (sessionId: number) => Effect.Effect<FinishedSession, WrapUpFailure>;
  readonly saveWord: (word: TakenWord) => Effect.Effect<PhraseCard, WrapUpFailure>;
  readonly updates: (sessionId: number) => Stream.Stream<void>;
};

export class WrapUpService extends Context.Service<WrapUpService, WrapUpServiceShape>()(
  'features/wrap-up/WrapUpService',
) {
  static readonly layer = Layer.effect(
    WrapUpService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      const events = yield* IpcEvents;
      return {
        read: (sessionId) =>
          invokeCommand(ipc, 'get_session_wrapup', FinishedSessionSchema, { sessionId }).pipe(
            Effect.filterOrFail(
              (summary) => summary.session_id === sessionId,
              () =>
                new IpcDecodeError({
                  command: 'get_session_wrapup',
                  cause: `expected session ${sessionId}`,
                }),
            ),
          ),
        saveWord: ({ sessionId, sequence, phrase, meaning }) =>
          invokeCommand(ipc, 'save_phrase_card', PhraseCardRecordSchema, {
            phrase,
            meaning_or_note: meaning,
            session_id: sessionId,
            sequence,
          }),
        updates: (sessionId) =>
          events
            .listenAll([
              { event: COACHING_UPDATED_EVENT, schema: CoachingUpdatedSchema },
              { event: WRAPUP_UPDATED_EVENT, schema: WrapupUpdatedSchema },
            ])
            .pipe(
              Stream.filter(
                (event) => Option.isNone(event) || event.value.session_id === sessionId,
              ),
              Stream.map(() => undefined),
            ),
      };
    }),
  );
}
