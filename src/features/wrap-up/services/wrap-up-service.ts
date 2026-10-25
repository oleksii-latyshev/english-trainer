import { Context, Effect, Layer, Option, Stream } from 'effect';
import {
  COACHING_UPDATED_EVENT,
  CoachingUpdatedSchema,
  FinishedSessionSchema,
  Ipc,
  IpcDecodeError,
  IpcEvents,
  invokeCommand,
  invokeUnitCommand,
  PhraseCardRecordSchema,
  SavedWrapupPhrasesSchema,
  WRAPUP_UPDATED_EVENT,
  WrapupUpdatedSchema,
} from '@/core/ipc';
import type {
  AnswerPhrase,
  FinishedSession,
  PhraseCard,
  SavedPhrases,
  WrapUpFailure,
} from '../types';

type WrapUpServiceShape = {
  readonly read: (sessionId: number) => Effect.Effect<FinishedSession, WrapUpFailure>;
  readonly retryPreparation: (sessionId: number) => Effect.Effect<void, WrapUpFailure>;
  readonly savePhrases: (
    sessionId: number,
    phrases: readonly string[],
  ) => Effect.Effect<SavedPhrases, WrapUpFailure>;
  readonly saveAnswerPhrase: (answer: AnswerPhrase) => Effect.Effect<PhraseCard, WrapUpFailure>;
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
        retryPreparation: (sessionId) =>
          invokeUnitCommand(ipc, 'retry_session_wrapup', { sessionId }),
        savePhrases: (sessionId, phrases) =>
          invokeCommand(ipc, 'save_wrapup_phrases', SavedWrapupPhrasesSchema, {
            sessionId,
            phrases,
          }),
        saveAnswerPhrase: ({ sessionId, sequence, phrase, note }) =>
          invokeCommand(ipc, 'save_phrase_card', PhraseCardRecordSchema, {
            phrase,
            meaning_or_note: note,
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
