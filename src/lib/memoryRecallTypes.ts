import {
  isLearningItemType,
  isLearningStatus,
  isReviewResponse,
  type LearningItemType,
  type LearningStatus,
  type ReviewResponse,
} from './learningTypes';

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return key in value;
}

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && [...value].length <= maxLength;
}

type MemoryReviewItemBase = {
  position: number;
  item_type: LearningItemType;
  item_id: number;
  cue: string;
};

export type PendingMemoryReviewItem = MemoryReviewItemBase & {
  target: null;
  transcript: null;
  wording_observed: null;
  saved_response: null;
  next_review_at: null;
  interval_days: null;
  status: null;
  is_skipped: false;
};

/** Passed on by the learner: closed without a score, so it stays due and keeps its target hidden. */
export type SkippedMemoryReviewItem = Omit<PendingMemoryReviewItem, 'is_skipped'> & {
  is_skipped: true;
};

export type SavedMemoryReviewItem = MemoryReviewItemBase & {
  target: string;
  transcript: string;
  wording_observed: boolean;
  saved_response: ReviewResponse;
  next_review_at: number;
  interval_days: number;
  status: LearningStatus;
  is_skipped: false;
};

export type MemoryReviewItem =
  | PendingMemoryReviewItem
  | SkippedMemoryReviewItem
  | SavedMemoryReviewItem;

export type MemoryReviewRun = {
  run_id: number;
  items: MemoryReviewItem[];
  completed: boolean;
};

export type MemoryRecallResult = {
  run_id: number;
  position: number;
  item_type: LearningItemType;
  item_id: number;
  cue: string;
  target: string;
  transcript: string;
  wording_observed: boolean;
  saved_response: ReviewResponse;
  next_review_at: number;
  interval_days: number;
  status: LearningStatus;
};

function isSavedItem(value: Record<string, unknown>): boolean {
  const isUnscored = value.target === null && value.transcript === null;
  if (isUnscored) {
    return (
      value.wording_observed === null &&
      value.saved_response === null &&
      value.next_review_at === null &&
      value.interval_days === null &&
      value.status === null &&
      typeof value.is_skipped === 'boolean'
    );
  }
  return (
    value.is_skipped === false &&
    isBoundedText(value.target, 300) &&
    isBoundedText(value.transcript, 4000) &&
    typeof value.wording_observed === 'boolean' &&
    isReviewResponse(value.saved_response) &&
    value.saved_response === (value.wording_observed ? 'remembered' : 'need_practice') &&
    isSafeInteger(value.next_review_at) &&
    isSafeInteger(value.interval_days, 1) &&
    value.interval_days <= 365 &&
    isLearningStatus(value.status)
  );
}

/** Neither answered nor skipped yet. */
export function isUnresolved(item: MemoryReviewItem): item is PendingMemoryReviewItem {
  return item.saved_response === null && !item.is_skipped;
}

export function isMemoryReviewItem(value: unknown): value is MemoryReviewItem {
  if (!isRecord(value)) return false;
  const item = value;
  return (
    isSafeInteger(item.position, 1) &&
    item.position <= 6 &&
    isLearningItemType(item.item_type) &&
    isSafeInteger(item.item_id, 1) &&
    isBoundedText(item.cue, 500) &&
    hasOwn(item, 'target') &&
    hasOwn(item, 'transcript') &&
    hasOwn(item, 'wording_observed') &&
    hasOwn(item, 'saved_response') &&
    hasOwn(item, 'next_review_at') &&
    hasOwn(item, 'interval_days') &&
    hasOwn(item, 'status') &&
    hasOwn(item, 'is_skipped') &&
    isSavedItem(item)
  );
}

export function isMemoryReviewRun(value: unknown): value is MemoryReviewRun {
  if (!isRecord(value)) return false;
  const run = value;
  if (
    !isSafeInteger(run.run_id, 1) ||
    run.completed !== false ||
    !Array.isArray(run.items) ||
    run.items.length === 0 ||
    run.items.length > 6 ||
    !run.items.every(isMemoryReviewItem)
  ) {
    return false;
  }
  const items = run.items;
  return items.every((item, index) => {
    if (item.position !== index + 1) return false;
    // Items close in order: nothing after an unanswered item is answered or skipped.
    if (index > 0 && isUnresolved(items[index - 1]) && !isUnresolved(item)) return false;
    return !items
      .slice(0, index)
      .some((prior) => prior.item_type === item.item_type && prior.item_id === item.item_id);
  });
}

export function isMemoryRecallResult(value: unknown): value is MemoryRecallResult {
  if (!isRecord(value)) return false;
  const result = value;
  return (
    isSafeInteger(result.run_id, 1) &&
    isSafeInteger(result.position, 1) &&
    result.position <= 6 &&
    isLearningItemType(result.item_type) &&
    isSafeInteger(result.item_id, 1) &&
    isBoundedText(result.cue, 500) &&
    isBoundedText(result.target, 300) &&
    isBoundedText(result.transcript, 4000) &&
    typeof result.wording_observed === 'boolean' &&
    isReviewResponse(result.saved_response) &&
    result.saved_response === (result.wording_observed ? 'remembered' : 'need_practice') &&
    isSafeInteger(result.next_review_at) &&
    isSafeInteger(result.interval_days, 1) &&
    result.interval_days <= 365 &&
    isLearningStatus(result.status)
  );
}
