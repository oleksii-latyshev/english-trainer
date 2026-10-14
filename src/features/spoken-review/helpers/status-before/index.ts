import type { LearningStatus } from '@/core/ipc';
import type { LearningMemory } from '@/core/learning-memory';

export type StatusBefore = ReadonlyMap<string, LearningStatus>;

export const NO_STATUS_BEFORE: StatusBefore = new Map();

export function itemKey(itemType: 'phrase' | 'mistake', itemId: number): string {
  return `${itemType}:${itemId}`;
}

export function statusBeforeOf(memory: LearningMemory): StatusBefore {
  const statuses = new Map<string, LearningStatus>();
  for (const card of memory.phrase_cards) statuses.set(itemKey('phrase', card.id), card.status);
  for (const mistake of memory.mistakes)
    statuses.set(itemKey('mistake', mistake.id), mistake.status);
  return statuses;
}
