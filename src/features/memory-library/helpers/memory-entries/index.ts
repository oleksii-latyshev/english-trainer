import type { LearningStatus } from '@/core/ipc';
import type { LearningMemory } from '@/core/learning-memory';
import type { ActiveStatus, EntryRef, MemoryEntry, StatusCounts } from '../../types';

export const ACTIVE_STATUSES: readonly ActiveStatus[] = [
  'new',
  'learning',
  'improving',
  'stable',
] as const;

export function toEntries(view: LearningMemory): readonly MemoryEntry[] {
  return view.phrase_cards.map((card): MemoryEntry => ({ kind: 'phrase', card }));
}

export function entryRef(entry: MemoryEntry): EntryRef {
  return { itemType: 'phrase', itemId: entry.card.id };
}

export function entryKey(entry: MemoryEntry): string {
  const { itemType, itemId } = entryRef(entry);
  return `${itemType}-${itemId}`;
}

export function entryStatus(entry: MemoryEntry): LearningStatus {
  return entry.card.status;
}

export function entryLabel(entry: MemoryEntry): string {
  return entry.card.phrase;
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
  return matches(
    query,
    entry.card.phrase,
    entry.card.meaning_or_note,
    entry.card.session_topic ?? '',
  );
}

export function searchEntries(
  entries: readonly MemoryEntry[],
  rawQuery: string,
): readonly MemoryEntry[] {
  const query = rawQuery.trim().toLowerCase();
  return query ? entries.filter((entry) => matchesEntry(entry, query)) : entries;
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
  return entry.card.times_used_on_own;
}
