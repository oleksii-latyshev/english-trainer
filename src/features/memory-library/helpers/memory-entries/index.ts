import type { LearningStatus } from '@/core/ipc';
import type { LearningMemory } from '@/core/learning-memory';
import type { ActiveStatus, EntryRef, MemoryEntry, MemoryTab, StatusCounts } from '../../types';

export const ACTIVE_STATUSES: readonly ActiveStatus[] = [
  'new',
  'learning',
  'improving',
  'stable',
] as const;

export function toEntries(view: LearningMemory): readonly MemoryEntry[] {
  return [
    ...view.phrase_cards.map((card): MemoryEntry => ({ kind: 'phrase', card })),
    ...view.mistakes.map((mistake): MemoryEntry => ({ kind: 'mistake', mistake })),
  ];
}

export function entryRef(entry: MemoryEntry): EntryRef {
  return entry.kind === 'phrase'
    ? { itemType: 'phrase', itemId: entry.card.id }
    : { itemType: 'mistake', itemId: entry.mistake.id };
}

export function entryKey(entry: MemoryEntry): string {
  const { itemType, itemId } = entryRef(entry);
  return `${itemType}-${itemId}`;
}

export function entryStatus(entry: MemoryEntry): LearningStatus {
  return entry.kind === 'phrase' ? entry.card.status : entry.mistake.status;
}

export function entryLabel(entry: MemoryEntry): string {
  return entry.kind === 'phrase'
    ? entry.card.phrase
    : `${entry.mistake.original_example} → ${entry.mistake.corrected_example}`;
}

function tabOf(entry: MemoryEntry): MemoryTab {
  return entry.kind === 'phrase' ? 'phrases' : 'mistakes';
}

export function visibleEntries(
  entries: readonly MemoryEntry[],
  showArchived: boolean,
): readonly MemoryEntry[] {
  return showArchived ? entries : entries.filter((entry) => entryStatus(entry) !== 'archived');
}

function matches(query: string, ...fields: readonly string[]): boolean {
  return fields.some((field) => field.toLowerCase().includes(query));
}

function matchesEntry(entry: MemoryEntry, query: string): boolean {
  if (entry.kind === 'phrase') {
    return matches(
      query,
      entry.card.phrase,
      entry.card.meaning_or_note,
      entry.card.session_topic ?? '',
    );
  }
  const { mistake } = entry;
  return matches(
    query,
    mistake.original_example,
    mistake.corrected_example,
    mistake.explanation,
    mistake.category,
  );
}

export function searchEntries(
  entries: readonly MemoryEntry[],
  rawQuery: string,
): readonly MemoryEntry[] {
  const query = rawQuery.trim().toLowerCase();
  return query ? entries.filter((entry) => matchesEntry(entry, query)) : entries;
}

export function entriesOfTab(
  entries: readonly MemoryEntry[],
  tab: MemoryTab,
): readonly MemoryEntry[] {
  return entries.filter((entry) => tabOf(entry) === tab);
}

export function statusCounts(entries: readonly MemoryEntry[]): StatusCounts {
  const counts: Record<ActiveStatus, number> = { new: 0, learning: 0, improving: 0, stable: 0 };
  for (const entry of entries) {
    const status = entryStatus(entry);
    if (status !== 'archived') counts[status] += 1;
  }
  return counts;
}

export function usedOnOwnCount(entry: MemoryEntry): number {
  return entry.kind === 'phrase'
    ? entry.card.times_used_on_own
    : entry.mistake.times_correct_afterwards;
}
