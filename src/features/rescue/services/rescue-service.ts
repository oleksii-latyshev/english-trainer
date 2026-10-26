import { Context, Effect, Layer } from 'effect';
import { Ipc, invokeCommand, RescueResponseSchema } from '@/core/ipc';
import type { RescueAnswer, RescueFailure, RescueRequestInput } from '../types';

type RescueServiceShape = {
  readonly answer: (
    input: RescueRequestInput,
    partialTranscript: string,
  ) => Effect.Effect<RescueAnswer, RescueFailure>;
};

export class RescueService extends Context.Service<RescueService, RescueServiceShape>()(
  'features/rescue/RescueService',
) {
  static readonly layer = Layer.effect(
    RescueService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        answer: ({ target, kind, description }, partialTranscript) =>
          invokeCommand(ipc, 'rescue_answer', RescueResponseSchema, {
            session_id: target.sessionId,
            sequence: target.sequence,
            request: {
              kind,
              question: target.question,
              partial_transcript: partialTranscript,
              description: description.trim(),
            },
          }),
      };
    }),
  );
}
