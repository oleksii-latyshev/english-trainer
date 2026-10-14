import type { LearningStatus } from '@/core/ipc';
import type { ReviewItem } from '@/core/learning-memory';

export type SummaryEntry = {
  readonly key: string;
  readonly label: string;
  readonly outcome: 'used' | 'not-yet' | 'skipped';
  readonly status: LearningStatus | null;
};

export type ReviewSummary = {
  readonly headline: string;
  readonly usedCount: number;
  readonly totalCount: number;
  readonly entries: readonly SummaryEntry[];
};

export function returnsIn(intervalDays: number): string {
  return intervalDays === 1 ? 'tomorrow' : `in ${intervalDays} days`;
}

export type StatusMove = {
  readonly prefix: 'Moves to' | 'Stays' | 'Now';
  readonly status: string;
};

export function statusLabel(status: LearningStatus): string {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

export function statusMove(before: LearningStatus | null, after: LearningStatus): StatusMove {
  const status = statusLabel(after);
  if (before === null) return { prefix: 'Now', status };
  return { prefix: before === after ? 'Stays' : 'Moves to', status };
}

function entryFor(item: ReviewItem): SummaryEntry | null {
  const key = `${item.item_type}-${item.item_id}`;
  if (item.saved_response !== null) {
    return {
      key,
      label: item.target ?? item.cue,
      outcome: item.wording_observed ? 'used' : 'not-yet',
      status: item.status,
    };
  }
  return item.is_skipped ? { key, label: item.cue, outcome: 'skipped', status: null } : null;
}

export function summarizeReview(items: readonly ReviewItem[]): ReviewSummary {
  const entries = items.flatMap((item) => entryFor(item) ?? []);
  const used = entries.filter((entry) => entry.outcome === 'used').length;
  const notYet = entries.filter((entry) => entry.outcome === 'not-yet').length;
  const skipped = entries.filter((entry) => entry.outcome === 'skipped').length;
  const noun = items.every((item) => item.item_type === 'phrase') ? 'phrases' : 'items';
  const parts = [`You used ${used} of ${entries.length} ${noun} during this review.`];
  if (notYet > 0) parts.push('The rest come back tomorrow.');
  if (skipped > 0) {
    parts.push(`${skipped === 1 ? 'The skipped one stays' : 'Skipped ones stay'} due.`);
  }
  return { headline: parts.join(' '), usedCount: used, totalCount: entries.length, entries };
}
