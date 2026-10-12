import { Context, Effect, Layer } from 'effect';
import {
  type ConversationTurn,
  ConversationTurnSchema,
  Ipc,
  invokeCommand,
  openReplyChannel,
} from '@/core/ipc';
import type { ResponseTestFailure } from '../types';

type ResponseTestServiceShape = {
  readonly run: (
    transcript: string,
    onDelta: (text: string) => void,
  ) => Effect.Effect<ConversationTurn, ResponseTestFailure>;
};

export class ResponseTestService extends Context.Service<
  ResponseTestService,
  ResponseTestServiceShape
>()('features/ai-provider/ResponseTestService') {
  static readonly layer = Layer.effect(
    ResponseTestService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        run: (transcript, onDelta) =>
          Effect.suspend(() =>
            invokeCommand(ipc, 'generate_follow_up', ConversationTurnSchema, {
              transcript,
              onReply: openReplyChannel(onDelta),
            }),
          ),
      };
    }),
  );
}
