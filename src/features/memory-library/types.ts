import type { LearningItemType, LearningStatus, PhraseCardRecord } from '@/core/ipc';

export type MemoryEntry = { readonly kind: 'phrase'; readonly card: PhraseCardRecord };

export type ActiveStatus = Exclude<LearningStatus, 'archived'>;

export type StatusCounts = Readonly<Record<ActiveStatus, number>>;

export type EntryRef = { readonly itemType: LearningItemType; readonly itemId: number };

export type SayNow = {
  readonly isDisabled: boolean;
  readonly onSay: (ref: EntryRef) => void;
};
