import { Context, Effect, Layer, Schema } from 'effect';
import {
  type ConversationTurn,
  ConversationTurnSchema,
  Ipc,
  invokeCommand,
  openReplyChannel,
} from '@/core/ipc';
import type { InputSource } from '@/core/practice-session';
import type { TurnFailure } from '../types';

type SendRequest = {
  readonly sessionId: number;
  readonly transcript: string;
  readonly source: InputSource;
  readonly answerDurationMs: number | undefined;
  readonly onDelta: (text: string) => void;
};

type PracticeTurnsShape = {
  readonly send: (request: SendRequest) => Effect.Effect<ConversationTurn, TurnFailure>;
  readonly cancel: (sessionId: number) => Effect.Effect<boolean, TurnFailure>;
};

export class PracticeTurns extends Context.Service<PracticeTurns, PracticeTurnsShape>()(
  'core/practice-turn/PracticeTurns',
) {
  static readonly layer = Layer.effect(
    PracticeTurns,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        send: (request) =>
          Effect.suspend(() =>
            invokeCommand(ipc, 'send_practice_turn', ConversationTurnSchema, {
              sessionId: request.sessionId,
              transcript: request.transcript,
              inputSource: request.source,
              answerDurationMs: request.answerDurationMs,
              onReply: openReplyChannel(request.onDelta),
            }),
          ),
        cancel: (sessionId) =>
          invokeCommand(ipc, 'cancel_practice_reply', Schema.Boolean, { sessionId }),
      };
    }),
  );
}
