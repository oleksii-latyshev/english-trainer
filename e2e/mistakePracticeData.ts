import type { LearningMemoryView, MistakeRecord } from '../src/lib/learningTypes';

export const repeatedMistake: MistakeRecord = {
  id: 17,
  normalized_key: 'grammar:at university',
  category: 'grammar',
  original_example: 'in the university',
  corrected_example: 'at university',
  explanation: 'Use at university when talking about being a student.',
  times_seen: 3,
  times_correct_afterwards: 0,
  last_seen_at: 1_800_000_000_000,
  last_reviewed_at: null,
  next_review_at: 1_900_000_000_000,
  interval_days: 7,
  ease_factor: 2.5,
  status: 'learning',
  is_due: false,
};

export const mistakeMemory: LearningMemoryView = {
  mistakes: [repeatedMistake],
  phrase_cards: [],
  due_count: 0,
};
