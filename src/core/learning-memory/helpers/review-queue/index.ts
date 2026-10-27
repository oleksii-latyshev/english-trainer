import type { RecallResult, ReviewItem, ReviewRun } from '../../types';

function isUnresolved(item: ReviewItem): boolean {
  return item.saved_response === null && !item.is_skipped;
}

export function currentPendingItem(items: readonly ReviewItem[]): ReviewItem | null {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return sorted.find(isUnresolved) ?? null;
}

export function resolvedItemCount(items: readonly ReviewItem[]): number {
  return items.filter((item) => !isUnresolved(item)).length;
}

export function isRunFinished(items: readonly ReviewItem[]): boolean {
  return items.length > 0 && items.every((item) => !isUnresolved(item));
}

function matchesQueueItem(run: ReviewRun, result: RecallResult): boolean {
  const queued = run.items.find(
    (item) => item.item_type === result.item_type && item.item_id === result.item_id,
  );
  if (
    result.run_id !== run.run_id ||
    !queued ||
    result.position !== queued.position ||
    result.cue !== queued.cue
  ) {
    return false;
  }
  return (
    queued.saved_response === null ||
    (queued.transcript === result.transcript && queued.target === result.target)
  );
}

export function mergeRecallResult(run: ReviewRun, result: RecallResult): ReviewRun | null {
  if (!matchesQueueItem(run, result)) return null;
  return {
    ...run,
    items: run.items.map((item) =>
      item.item_type === result.item_type && item.item_id === result.item_id
        ? {
            position: item.position,
            item_type: item.item_type,
            item_id: item.item_id,
            cue: item.cue,
            target: result.target,
            transcript: result.transcript,
            wording_observed: result.wording_observed,
            saved_response: result.saved_response,
            next_review_at: result.next_review_at,
            interval_days: result.interval_days,
            status: result.status,
            is_skipped: false,
          }
        : item,
    ),
  };
}
