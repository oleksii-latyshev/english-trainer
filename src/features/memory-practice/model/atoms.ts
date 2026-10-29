import { Option } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import {
  activeReviewRunAtom,
  openedLearningMemoryAtom,
  resolvedItemCount,
} from '@/core/learning-memory';
import { usualRulesAtom } from '@/core/mistakes';
import type { ActiveReview } from '../types';

const SAMPLE_COUNT = 2;

export type PracticeTargets =
  | { readonly tag: 'loading' }
  | { readonly tag: 'unavailable' }
  | {
      readonly tag: 'ready';
      readonly dueCount: number;
      readonly practicableCount: number;
      readonly samples: readonly string[];
    };

export const practiceTargetsAtom = Atom.make((get): PracticeTargets => {
  const result = get(openedLearningMemoryAtom);
  const view = Option.getOrNull(AsyncResult.value(result));
  const usual = get(usualRulesAtom);
  if (!view || usual.tag !== 'ready') {
    const isUnavailable = AsyncResult.isFailure(result) || usual.tag === 'unavailable';
    return isUnavailable ? { tag: 'unavailable' } : { tag: 'loading' };
  }
  return {
    tag: 'ready',
    dueCount: view.due_count,
    practicableCount: usual.rules.reduce((sum, rule) => sum + rule.mistake_count, 0),
    samples: usual.rules
      .flatMap((rule) => rule.mistakes)
      .slice(0, SAMPLE_COUNT)
      .map((mistake) => mistake.said),
  };
});

export const activeReviewAtom = Atom.make((get): ActiveReview => {
  const run = Option.getOrNull(AsyncResult.value(get(activeReviewRunAtom)));
  if (run === null) return { tag: 'none' };
  return { tag: 'saved', resolved: resolvedItemCount(run.items), total: run.items.length };
});
