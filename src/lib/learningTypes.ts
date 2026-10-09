import { type FeedbackCategory, isFeedbackCategory } from '@/lib/types';

function isBoundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isReviewNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export type LearningStatus = 'new' | 'learning' | 'improving' | 'stable' | 'archived';

export function isLearningStatus(value: unknown): value is LearningStatus {
  return (
    value === 'new' ||
    value === 'learning' ||
    value === 'improving' ||
    value === 'stable' ||
    value === 'archived'
  );
}

export type ReviewResponse = 'remembered' | 'need_practice';

export function isReviewResponse(value: unknown): value is ReviewResponse {
  return value === 'remembered' || value === 'need_practice';
}

export type LearningItemType = 'mistake' | 'phrase';

export function isLearningItemType(value: unknown): value is LearningItemType {
  return value === 'mistake' || value === 'phrase';
}

export type MistakeRecord = {
  id: number;
  normalized_key: string;
  category: FeedbackCategory;
  original_example: string;
  corrected_example: string;
  explanation: string;
  times_seen: number;
  times_correct_afterwards: number;
  last_seen_at: number;
  last_reviewed_at: number | null;
  next_review_at: number;
  interval_days: number;
  ease_factor: number;
  status: LearningStatus;
  is_due: boolean;
};

export function isMistakeRecord(value: unknown): value is MistakeRecord {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value &&
    isPositiveInteger(value.id) &&
    'normalized_key' in value &&
    isBoundedText(value.normalized_key, 340) &&
    'category' in value &&
    isFeedbackCategory(value.category) &&
    'original_example' in value &&
    isBoundedText(value.original_example, 300) &&
    'corrected_example' in value &&
    isBoundedText(value.corrected_example, 300) &&
    'explanation' in value &&
    typeof value.explanation === 'string' &&
    value.explanation.length <= 500 &&
    'times_seen' in value &&
    isNonNegativeInteger(value.times_seen) &&
    'times_correct_afterwards' in value &&
    isNonNegativeInteger(value.times_correct_afterwards) &&
    'last_seen_at' in value &&
    isNonNegativeInteger(value.last_seen_at) &&
    'last_reviewed_at' in value &&
    (value.last_reviewed_at === null || isNonNegativeInteger(value.last_reviewed_at)) &&
    'next_review_at' in value &&
    isNonNegativeInteger(value.next_review_at) &&
    'interval_days' in value &&
    isPositiveInteger(value.interval_days) &&
    value.interval_days <= 365 &&
    'ease_factor' in value &&
    isReviewNumber(value.ease_factor) &&
    value.ease_factor >= 1.3 &&
    value.ease_factor <= 3 &&
    'status' in value &&
    isLearningStatus(value.status) &&
    'is_due' in value &&
    typeof value.is_due === 'boolean'
  );
}

export type PhraseCardRecord = {
  id: number;
  phrase: string;
  normalized_phrase: string;
  meaning_or_note: string;
  session_id: number | null;
  sequence: number | null;
  session_topic?: string | null;
  created_at: number;
  last_reviewed_at: number | null;
  next_review_at: number;
  interval_days: number;
  ease_factor: number;
  status: LearningStatus;
  is_due: boolean;
};

export function isPhraseCardRecord(value: unknown): value is PhraseCardRecord {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value &&
    isPositiveInteger(value.id) &&
    'phrase' in value &&
    isBoundedText(value.phrase, 300) &&
    'normalized_phrase' in value &&
    isBoundedText(value.normalized_phrase, 300) &&
    'meaning_or_note' in value &&
    typeof value.meaning_or_note === 'string' &&
    value.meaning_or_note.length <= 500 &&
    'session_id' in value &&
    (value.session_id === null || isPositiveInteger(value.session_id)) &&
    'sequence' in value &&
    (value.sequence === null || isPositiveInteger(value.sequence)) &&
    (!('session_topic' in value) ||
      value.session_topic === null ||
      (typeof value.session_topic === 'string' &&
        value.session_topic.trim().length > 0 &&
        Array.from(value.session_topic).length <= 150)) &&
    (value.session_id === null) === (value.sequence === null) &&
    'created_at' in value &&
    isNonNegativeInteger(value.created_at) &&
    'last_reviewed_at' in value &&
    (value.last_reviewed_at === null || isNonNegativeInteger(value.last_reviewed_at)) &&
    'next_review_at' in value &&
    isNonNegativeInteger(value.next_review_at) &&
    'interval_days' in value &&
    isPositiveInteger(value.interval_days) &&
    value.interval_days <= 365 &&
    'ease_factor' in value &&
    isReviewNumber(value.ease_factor) &&
    value.ease_factor >= 1.3 &&
    value.ease_factor <= 3 &&
    'status' in value &&
    isLearningStatus(value.status) &&
    'is_due' in value &&
    typeof value.is_due === 'boolean'
  );
}

export type LearningMemoryView = {
  mistakes: MistakeRecord[];
  phrase_cards: PhraseCardRecord[];
  due_count: number;
};

export function isLearningMemoryView(value: unknown): value is LearningMemoryView {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'mistakes' in value &&
    Array.isArray(value.mistakes) &&
    value.mistakes.every(isMistakeRecord) &&
    'phrase_cards' in value &&
    Array.isArray(value.phrase_cards) &&
    value.phrase_cards.every(isPhraseCardRecord) &&
    'due_count' in value &&
    isNonNegativeInteger(value.due_count)
  );
}
