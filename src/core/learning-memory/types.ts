import type {
  IpcDecodeError,
  IpcError,
  LearningItemType,
  LearningMemoryViewSchema,
  MemoryRecallResultSchema,
  MemoryReviewRunSchema,
  MemoryUsageEvidenceSchema,
  ReviewMaterialsSchema,
} from '@/core/ipc';

export type LearningMemoryFailure = IpcError | IpcDecodeError;

export type LearningMemory = typeof LearningMemoryViewSchema.Type;

export type MemoryEvidence = typeof MemoryUsageEvidenceSchema.Type;

export type ReviewRun = typeof MemoryReviewRunSchema.Type;

export type ReviewItem = ReviewRun['items'][number];

export type RecallResult = typeof MemoryRecallResultSchema.Type;

export type ReviewMaterials = typeof ReviewMaterialsSchema.Type;

export type LearningItemRef = {
  readonly itemType: LearningItemType;
  readonly itemId: number;
};

export type ReviewItemRef = LearningItemRef & { readonly runId: number };
