import { Context, Effect, Layer, Schema } from 'effect';
import { Ipc, IpcDecodeError, invokeCommand, TurnUsageAssessmentSchema } from '@/core/ipc';
import type { TurnUsageAssessment, UsageReviewFailure, UsageTarget } from '../types';

type UsageReviewServiceShape = {
  readonly saved: (
    target: UsageTarget,
  ) => Effect.Effect<TurnUsageAssessment | null, UsageReviewFailure>;
  readonly review: (target: UsageTarget) => Effect.Effect<TurnUsageAssessment, UsageReviewFailure>;
};

const SavedAssessment = Schema.NullOr(TurnUsageAssessmentSchema);

function arguments_({ sessionId, sequence }: UsageTarget) {
  return { session_id: sessionId, sequence };
}

function isOfTarget(assessment: TurnUsageAssessment, target: UsageTarget): boolean {
  return assessment.session_id === target.sessionId && assessment.sequence === target.sequence;
}

function mismatch(command: string, target: UsageTarget) {
  return new IpcDecodeError({
    command,
    cause: `expected answer ${target.sequence} of session ${target.sessionId}`,
  });
}

export class UsageReviewService extends Context.Service<
  UsageReviewService,
  UsageReviewServiceShape
>()('features/usage-review/UsageReviewService') {
  static readonly layer = Layer.effect(
    UsageReviewService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        saved: (target) =>
          invokeCommand(ipc, 'get_practice_memory_usage', SavedAssessment, arguments_(target)).pipe(
            Effect.filterOrFail(
              (assessment) => assessment === null || isOfTarget(assessment, target),
              () => mismatch('get_practice_memory_usage', target),
            ),
          ),
        review: (target) =>
          invokeCommand(
            ipc,
            'review_practice_memory_usage',
            TurnUsageAssessmentSchema,
            arguments_(target),
          ).pipe(
            Effect.filterOrFail(
              (assessment) => isOfTarget(assessment, target),
              () => mismatch('review_practice_memory_usage', target),
            ),
          ),
      };
    }),
  );
}
