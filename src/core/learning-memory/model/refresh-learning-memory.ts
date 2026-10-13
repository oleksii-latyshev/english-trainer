import { appRegistry } from '@/core/runtime';
import { learningMemoryAtom, openedLearningMemoryAtom } from './atoms';

export function refreshLearningMemory(): void {
  appRegistry.refresh(learningMemoryAtom);
  appRegistry.refresh(openedLearningMemoryAtom);
}
