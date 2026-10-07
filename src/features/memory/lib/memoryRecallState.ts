import type { LearningStatus } from '@/lib/learningTypes';
import {
  isUnresolved,
  type MemoryRecallResult,
  type MemoryReviewItem,
  type MemoryReviewRun,
  type PendingMemoryReviewItem,
  type SavedMemoryReviewItem,
} from '@/lib/memoryRecallTypes';

/** The next item that is neither answered nor skipped. */
export function getCurrentPendingItem(items: MemoryReviewItem[]): PendingMemoryReviewItem | null {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return sorted.find(isUnresolved) ?? null;
}

/** Items closed so far, answered or skipped. */
export function getResolvedItemCount(items: MemoryReviewItem[]): number {
  return items.filter((item) => !isUnresolved(item)).length;
}

export function isRunFinished(items: MemoryReviewItem[]): boolean {
  return items.length > 0 && items.every((item) => !isUnresolved(item));
}

export function mergeRecallResult(
  run: MemoryReviewRun,
  result: MemoryRecallResult,
): MemoryReviewRun {
  const matchingItem = run.items.find(
    (item) => item.item_type === result.item_type && item.item_id === result.item_id,
  );
  if (
    result.run_id !== run.run_id ||
    !matchingItem ||
    result.position !== matchingItem.position ||
    result.cue !== matchingItem.cue ||
    (matchingItem.saved_response !== null &&
      (matchingItem.transcript !== result.transcript || matchingItem.target !== result.target))
  ) {
    throw new Error('Spoken recall result does not match the active queue item.');
  }
  const saved: SavedMemoryReviewItem = {
    position: matchingItem.position,
    item_type: matchingItem.item_type,
    item_id: matchingItem.item_id,
    cue: matchingItem.cue,
    target: result.target,
    transcript: result.transcript,
    wording_observed: result.wording_observed,
    saved_response: result.saved_response,
    next_review_at: result.next_review_at,
    interval_days: result.interval_days,
    status: result.status,
    is_skipped: false,
  };
  return {
    ...run,
    items: run.items.map((item) =>
      item.item_type === result.item_type && item.item_id === result.item_id ? saved : item,
    ),
  };
}

/** "tomorrow" or "in 4 days": when an item returns for review. */
export function returnsIn(intervalDays: number): string {
  return intervalDays === 1 ? 'tomorrow' : `in ${intervalDays} days`;
}

/** What the answer did to the item's status; `before` is unknown after a resumed review. */
export function statusMove(before: LearningStatus | null, after: LearningStatus): string {
  if (before === null) return `Now ${after}`;
  return before === after ? `Stays ${after}` : `Moves to ${after}`;
}

export type SummaryEntry = {
  key: string;
  /** The phrase once it was answered; the cue for a skipped item, whose target stays hidden. */
  label: string;
  outcome: 'used' | 'not-yet' | 'skipped';
  /** The status after the answer; absent for a skipped item. */
  status: LearningStatus | null;
};

export type ReviewSummary = { headline: string; entries: SummaryEntry[] };

function entryFor(item: MemoryReviewItem): SummaryEntry | null {
  const key = `${item.item_type}-${item.item_id}`;
  if (item.saved_response !== null) {
    return {
      key,
      label: item.target,
      outcome: item.wording_observed ? 'used' : 'not-yet',
      status: item.status,
    };
  }
  return item.is_skipped ? { key, label: item.cue, outcome: 'skipped', status: null } : null;
}

/** The end-of-review list and the sentence above it. Counts only what the saved results say. */
export function summarizeReview(items: MemoryReviewItem[]): ReviewSummary {
  const entries = items.flatMap((item) => entryFor(item) ?? []);
  const used = entries.filter((entry) => entry.outcome === 'used').length;
  const notYet = entries.filter((entry) => entry.outcome === 'not-yet').length;
  const skipped = entries.filter((entry) => entry.outcome === 'skipped').length;
  const noun = items.every((item) => item.item_type === 'phrase') ? 'phrases' : 'items';
  const parts = [`You used ${used} of ${entries.length} ${noun} on the spot.`];
  if (notYet > 0) parts.push('The rest come back tomorrow.');
  if (skipped > 0)
    parts.push(`${skipped === 1 ? 'The skipped one stays' : 'Skipped ones stay'} due.`);
  return { headline: parts.join(' '), entries };
}
