import type {
  IpcDecodeError,
  IpcError,
  TurnUsageAssessmentSchema,
  UsageAssessmentFindingSchema,
} from '@/core/ipc';

export type TurnUsageAssessment = typeof TurnUsageAssessmentSchema.Type;

export type UsageFinding = typeof UsageAssessmentFindingSchema.Type;

export type UsageReviewFailure = IpcError | IpcDecodeError;

export type UsageTarget = {
  readonly sessionId: number;
  readonly sequence: number;
};

export type UsageReviewView =
  | { readonly tag: 'restoring' }
  | { readonly tag: 'idle' }
  | { readonly tag: 'checking' }
  | { readonly tag: 'restore-error'; readonly message: string }
  | { readonly tag: 'review-error'; readonly message: string }
  | { readonly tag: 'success'; readonly assessment: TurnUsageAssessment };
