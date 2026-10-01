import type {
  MemoryRecallResult,
  MemoryReviewItem,
  MemoryReviewRun,
} from '@/lib/memoryRecallTypes';

export function getCurrentPendingItem(items: MemoryReviewItem[]): MemoryReviewItem | null {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return sorted.find((item) => item.saved_response === null) ?? null;
}

export function getCompletedItemCount(items: MemoryReviewItem[]): number {
  return items.filter((item) => item.saved_response !== null).length;
}

export function isRunFinished(items: MemoryReviewItem[]): boolean {
  return items.length > 0 && items.every((item) => item.saved_response !== null);
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
  const updatedItems = run.items.map((item) => {
    if (item.item_type === result.item_type && item.item_id === result.item_id) {
      return {
        ...item,
        target: result.target,
        transcript: result.transcript,
        wording_observed: result.wording_observed,
        saved_response: result.saved_response,
        next_review_at: result.next_review_at,
        interval_days: result.interval_days,
        status: result.status,
      };
    }
    return item;
  });

  return {
    ...run,
    items: updatedItems,
  };
}
