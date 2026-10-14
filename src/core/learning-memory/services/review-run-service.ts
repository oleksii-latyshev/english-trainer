import { Context, Effect, Layer, Schema } from 'effect';
import {
  Ipc,
  invokeCommand,
  invokeUnitCommand,
  MemoryRecallResultSchema,
  MemoryReviewRunSchema,
  ReviewMaterialsSchema,
} from '@/core/ipc';
import type {
  LearningMemoryFailure,
  RecallResult,
  ReviewItemRef,
  ReviewMaterials,
  ReviewRun,
} from '../types';

type RecallInput = ReviewItemRef & { readonly transcript: string };

type ReviewRunServiceShape = {
  readonly start: (isWarmup: boolean) => Effect.Effect<ReviewRun | null, LearningMemoryFailure>;
  readonly active: Effect.Effect<ReviewRun | null, LearningMemoryFailure>;
  readonly submit: (input: RecallInput) => Effect.Effect<RecallResult, LearningMemoryFailure>;
  readonly skip: (ref: ReviewItemRef) => Effect.Effect<ReviewRun, LearningMemoryFailure>;
  readonly finish: (runId: number) => Effect.Effect<void, LearningMemoryFailure>;
  readonly materials: (runId: number) => Effect.Effect<ReviewMaterials, LearningMemoryFailure>;
  readonly prepareMaterials: (
    runId: number,
    isRetry: boolean,
  ) => Effect.Effect<ReviewMaterials, LearningMemoryFailure>;
  readonly revealPhrase: (
    runId: number,
    position: number,
  ) => Effect.Effect<ReviewMaterials, LearningMemoryFailure>;
};

const NullableRun = Schema.NullOr(MemoryReviewRunSchema);

export class ReviewRunService extends Context.Service<ReviewRunService, ReviewRunServiceShape>()(
  'core/learning-memory/ReviewRunService',
) {
  static readonly layer = Layer.effect(
    ReviewRunService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        start: (isWarmup) =>
          invokeCommand(ipc, 'start_memory_review', NullableRun, { warmup: isWarmup }),
        active: invokeCommand(ipc, 'get_memory_review', NullableRun),
        submit: ({ runId, itemType, itemId, transcript }) =>
          invokeCommand(ipc, 'submit_memory_recall', MemoryRecallResultSchema, {
            run_id: runId,
            item_type: itemType,
            item_id: itemId,
            transcript,
          }),
        skip: ({ runId, itemType, itemId }) =>
          invokeCommand(ipc, 'skip_memory_review_item', MemoryReviewRunSchema, {
            run_id: runId,
            item_type: itemType,
            item_id: itemId,
          }),
        finish: (runId) => invokeUnitCommand(ipc, 'finish_memory_review', { run_id: runId }),
        materials: (runId) =>
          invokeCommand(ipc, 'get_review_material', ReviewMaterialsSchema, { run_id: runId }),
        prepareMaterials: (runId, isRetry) =>
          invokeCommand(ipc, 'prepare_review_material', ReviewMaterialsSchema, {
            run_id: runId,
            retry: isRetry,
          }),
        revealPhrase: (runId, position) =>
          invokeCommand(ipc, 'reveal_review_phrase', ReviewMaterialsSchema, {
            run_id: runId,
            position,
          }),
      };
    }),
  );
}
