import type { LearningMemoryView } from '@/core/ipc';

export const reviewMemory: LearningMemoryView = {
  mistakes: [],
  due_count: 1,
  phrase_cards: [
    {
      id: 51,
      phrase: 'find a compromise',
      kind: 'phrase',
      normalized_phrase: 'find a compromise',
      meaning_or_note: 'Agree on a solution.',
      session_id: null,
      sequence: null,
      created_at: 1_800_000_000_000,
      last_reviewed_at: null,
      next_review_at: 1_800_000_000_000,
      interval_days: 1,
      ease_factor: 2.5,
      status: 'learning',
      is_due: true,
      times_used_on_own: 0,
    },
  ],
};

export const reviewMemoryWithDuePhrase: LearningMemoryView = {
  ...reviewMemory,
  due_count: 1,
  phrase_cards: [
    {
      ...reviewMemory.phrase_cards[0],
      is_due: false,
      last_reviewed_at: 1_800_000_000_000,
      next_review_at: 1_800_086_400_000,
      interval_days: 2,
      status: 'improving',
    },
    {
      ...reviewMemory.phrase_cards[0],
      id: 52,
      phrase: 'raise a concern',
      normalized_phrase: 'raise a concern',
      meaning_or_note: 'Mention a problem or worry.',
    },
  ],
};
