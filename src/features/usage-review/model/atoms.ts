import { Data, Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { LEARNING_MEMORY } from '@/core/learning-memory';
import { UsageReviewService } from '../services/usage-review-service';
import type { UsageReviewView, UsageTarget } from '../types';
import { runtime } from './runtime';

const RESTORE_FAILED = 'Could not restore this saved review. Retry to check for an earlier result.';
const REVIEW_FAILED = 'Could not complete the learning use review. Please retry.';

class TargetKey extends Data.Class<UsageTarget> {}

export function usageKey(target: UsageTarget): UsageTarget {
  return new TargetKey(target);
}

export const savedUsageAtom = Atom.family((target: UsageTarget) =>
  runtime.atom(Effect.flatMap(UsageReviewService, (service) => service.saved(target))),
);

export const reviewUsageAtom = Atom.family((target: UsageTarget) =>
  runtime.fn(
    Effect.fn('reviewUsage')(function* (_: undefined) {
      const service = yield* UsageReviewService;
      return yield* service.review(target);
    }),
    { reactivityKeys: LEARNING_MEMORY },
  ),
);

export const usageReviewViewAtom = Atom.family((target: UsageTarget) =>
  Atom.make((get): UsageReviewView => {
    const review = get(reviewUsageAtom(target));
    if (AsyncResult.isWaiting(review)) return { tag: 'checking' };
    if (AsyncResult.isSuccess(review)) return { tag: 'success', assessment: review.value };
    if (AsyncResult.isFailure(review)) return { tag: 'review-error', message: REVIEW_FAILED };
    const saved = get(savedUsageAtom(target));
    if (AsyncResult.isFailure(saved)) return { tag: 'restore-error', message: RESTORE_FAILED };
    if (!AsyncResult.isSuccess(saved)) return { tag: 'restoring' };
    return saved.value === null ? { tag: 'idle' } : { tag: 'success', assessment: saved.value };
  }),
);
