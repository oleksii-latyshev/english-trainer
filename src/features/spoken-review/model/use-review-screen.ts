import { useAtomMount, useAtomValue } from '@effect/atom-react';
import { reviewEffectsAtom } from './effects';
import { isWarmupAtom, reviewViewAtom, warmupHandoffAtom } from './session-atoms';
import { isAnsweringAtom, isSummaryAtom } from './view-atoms';

export function useReviewScreen() {
  useAtomMount(reviewEffectsAtom);
  return {
    view: useAtomValue(reviewViewAtom),
    isWarmup: useAtomValue(isWarmupAtom),
    isSummary: useAtomValue(isSummaryAtom),
    isAnswering: useAtomValue(isAnsweringAtom),
  };
}

export function useWarmupHandoff(): boolean {
  return useAtomValue(warmupHandoffAtom);
}
