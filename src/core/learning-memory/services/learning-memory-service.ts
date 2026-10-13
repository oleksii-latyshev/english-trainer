import { Context, Effect, Layer, Schema } from 'effect';
import {
  Ipc,
  invokeCommand,
  LearningMemoryViewSchema,
  MemoryUsageEvidenceSchema,
} from '@/core/ipc';
import type {
  LearningItemRef,
  LearningMemory,
  LearningMemoryFailure,
  MemoryEvidence,
} from '../types';

type LearningMemoryServiceShape = {
  readonly read: Effect.Effect<LearningMemory, LearningMemoryFailure>;
  readonly open: Effect.Effect<LearningMemory, LearningMemoryFailure>;
  readonly usageEvidence: (
    ref: LearningItemRef,
  ) => Effect.Effect<MemoryEvidence, LearningMemoryFailure>;
  readonly archive: (ref: LearningItemRef) => Effect.Effect<boolean, LearningMemoryFailure>;
  readonly remove: (ref: LearningItemRef) => Effect.Effect<boolean, LearningMemoryFailure>;
};

export class LearningMemoryService extends Context.Service<
  LearningMemoryService,
  LearningMemoryServiceShape
>()('core/learning-memory/LearningMemoryService') {
  static readonly layer = Layer.effect(
    LearningMemoryService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        read: invokeCommand(ipc, 'get_learning_memory', LearningMemoryViewSchema),
        open: invokeCommand(ipc, 'view_learning_memory', LearningMemoryViewSchema),
        usageEvidence: ({ itemType, itemId }) =>
          invokeCommand(ipc, 'get_memory_usage_evidence', MemoryUsageEvidenceSchema, {
            item_type: itemType,
            item_id: itemId,
          }),
        archive: ({ itemType, itemId }) =>
          invokeCommand(ipc, 'archive_learning_item', Schema.Boolean, {
            item_type: itemType,
            item_id: itemId,
          }),
        remove: ({ itemType, itemId }) =>
          itemType === 'phrase'
            ? invokeCommand(ipc, 'delete_phrase_card', Schema.Boolean, { phrase_id: itemId })
            : invokeCommand(ipc, 'delete_mistake', Schema.Boolean, { mistake_id: itemId }),
      };
    }),
  );
}
