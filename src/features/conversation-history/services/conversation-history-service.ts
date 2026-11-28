import { Context, Effect, Layer } from 'effect';
import { FinishedSessionPageSchema, Ipc, invokeCommand } from '@/core/ipc';
import type { ConversationHistoryFailure, ConversationPage } from '../types';

type ConversationHistoryServiceShape = {
  readonly page: (
    limit: number,
    offset: number,
  ) => Effect.Effect<ConversationPage, ConversationHistoryFailure>;
};

export class ConversationHistoryService extends Context.Service<
  ConversationHistoryService,
  ConversationHistoryServiceShape
>()('features/conversation-history/ConversationHistoryService') {
  static readonly layer = Layer.effect(
    ConversationHistoryService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        page: (limit, offset) =>
          invokeCommand(ipc, 'list_finished_sessions', FinishedSessionPageSchema, {
            limit,
            offset,
          }),
      };
    }),
  );
}
