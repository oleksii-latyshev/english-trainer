import type {
  IpcDecodeError,
  IpcError,
  LearningItemType,
  LearningMemoryViewSchema,
  MemoryUsageEvidenceSchema,
} from '@/core/ipc';

export type LearningMemoryFailure = IpcError | IpcDecodeError;

export type LearningMemory = typeof LearningMemoryViewSchema.Type;

export type MemoryEvidence = typeof MemoryUsageEvidenceSchema.Type;

export type LearningItemRef = {
  readonly itemType: LearningItemType;
  readonly itemId: number;
};
