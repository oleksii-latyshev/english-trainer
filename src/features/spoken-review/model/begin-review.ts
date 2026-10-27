import type { AtomRegistry } from 'effect/reactivity';
import type { LearningItemRef } from '@/core/learning-memory';
import type { ReviewMode } from '../types';
import {
  captureOutcomeAtom,
  frozenPromptAtom,
  IDLE_OUTCOME,
  lastTranscriptAtom,
  liveTextAtom,
} from './capture-state';
import { reviewModeAtom, reviewTargetAtom, summaryReachedAtom } from './session-atoms';

export function beginReview(
  registry: AtomRegistry.AtomRegistry,
  mode: ReviewMode,
  target: LearningItemRef | null = null,
) {
  registry.set(reviewModeAtom, mode);
  registry.set(reviewTargetAtom, target);
  registry.set(summaryReachedAtom, false);
  registry.set(captureOutcomeAtom, IDLE_OUTCOME);
  registry.set(liveTextAtom, '');
  registry.set(lastTranscriptAtom, null);
  registry.set(frozenPromptAtom, null);
}
