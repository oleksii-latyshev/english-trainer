import { refreshLearningMemory } from '@/core/learning-memory';

export function notifyLearningMemoryChanged(): void {
  refreshLearningMemory();
  window.dispatchEvent(new Event('learning-memory-changed'));
}
