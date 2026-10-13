import type { LearningItemType, LearningStatus, MistakeRecord, PhraseCardRecord } from '@/core/ipc';

export type MemoryEntry =
  | { readonly kind: 'phrase'; readonly card: PhraseCardRecord }
  | { readonly kind: 'mistake'; readonly mistake: MistakeRecord };

export type MemoryTab = 'phrases' | 'mistakes';

export type ActiveStatus = Exclude<LearningStatus, 'archived'>;

export type StatusCounts = Readonly<Record<ActiveStatus, number>>;

export type EntryRef = { readonly itemType: LearningItemType; readonly itemId: number };
