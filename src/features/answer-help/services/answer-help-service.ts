import { Context, Effect, Layer } from 'effect';
import { AnswerPlanSchema, Ipc, invokeCommand, invokeUnitCommand } from '@/core/ipc';
import type { HelpFailure, HelpPlan, HelpTarget } from '../types';

type AnswerHelpServiceShape = {
  readonly plan: (target: HelpTarget, retry: boolean) => Effect.Effect<HelpPlan, HelpFailure>;
  readonly recordUsed: (target: HelpTarget) => Effect.Effect<void, HelpFailure>;
};

export class AnswerHelpService extends Context.Service<AnswerHelpService, AnswerHelpServiceShape>()(
  'features/answer-help/AnswerHelpService',
) {
  static readonly layer = Layer.effect(
    AnswerHelpService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        plan: (target, retry) =>
          invokeCommand(ipc, 'prefetch_answer_plan', AnswerPlanSchema, {
            session_id: target.sessionId,
            sequence: target.sequence,
            question: target.question,
            retry,
          }),
        recordUsed: (target) =>
          invokeUnitCommand(ipc, 'record_answer_help_used', {
            sessionId: target.sessionId,
            sequence: target.sequence,
          }),
      };
    }),
  );
}
