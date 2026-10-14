import type { LearningItemType } from '@/core/ipc';

export function phraseLabelOf(itemType: LearningItemType): string {
  return itemType === 'mistake' ? 'Say it the better way' : 'Use this phrase';
}
