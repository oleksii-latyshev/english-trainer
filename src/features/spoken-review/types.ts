import type { LearningStatus } from '@/core/ipc';
import type { RecallResult, ReviewRun } from '@/core/learning-memory';
import type { Attempt } from './helpers/result-view';
import type { ReviewActionError } from './helpers/review-issue';

export type ReviewMode = 'review' | 'warmup';

export type ReviewStep =
  | { readonly tag: 'answering' }
  | { readonly tag: 'result'; readonly result: RecallResult; readonly attempt: Attempt }
  | { readonly tag: 'closing' }
  | { readonly tag: 'summary' };

export type Pending = 'none' | 'saving' | 'skipping' | 'finishing';

export type Session = {
  readonly run: ReviewRun;
  readonly step: ReviewStep;
  readonly pending: Pending;
  readonly actionError: ReviewActionError | null;
};

export type OpenedReview = {
  readonly run: ReviewRun | null;
  readonly statusBefore: ReadonlyMap<string, LearningStatus>;
};

export type { ReviewActionError };
