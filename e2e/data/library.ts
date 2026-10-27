import type {
  LearningMemoryView,
  MemoryUsageEvidence,
  MistakeRecord,
  PhraseCardRecord,
} from '@/core/ipc';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const phrase: PhraseCardRecord = {
  id: 11,
  phrase: 'figure out',
  kind: 'phrasal_verb',
  normalized_phrase: 'figure out',
  meaning_or_note: 'to find the answer',
  session_id: 41,
  sequence: 2,
  session_topic: 'Daily stand-up',
  created_at: NOW - 3 * DAY_MS,
  last_reviewed_at: null,
  next_review_at: NOW - DAY_MS,
  interval_days: 3,
  ease_factor: 2.5,
  status: 'improving',
  is_due: true,
  times_used_on_own: 1,
};

const secondPhrase: PhraseCardRecord = {
  ...phrase,
  id: 12,
  phrase: 'stale data',
  kind: 'phrase',
  normalized_phrase: 'stale data',
  meaning_or_note: '',
  session_topic: 'Explaining a bug',
  next_review_at: NOW + 12 * DAY_MS,
  interval_days: 14,
  status: 'stable',
  is_due: false,
  times_used_on_own: 3,
};

const mistake: MistakeRecord = {
  id: 21,
  normalized_key: 'grammar:most of',
  category: 'grammar',
  original_example: 'the most part of',
  corrected_example: 'most of',
  explanation: '“Most” already means the biggest part, so English says “most of the users”.',
  times_seen: 4,
  times_correct_afterwards: 1,
  last_seen_at: NOW - DAY_MS,
  last_reviewed_at: null,
  next_review_at: NOW + DAY_MS,
  interval_days: 1,
  ease_factor: 2.5,
  status: 'learning',
  is_due: false,
};

export const libraryMemory: LearningMemoryView = {
  phrase_cards: [phrase, secondPhrase],
  mistakes: [mistake],
  due_count: 1,
};

export const figureOutEvidence: MemoryUsageEvidence = {
  item_type: 'phrase',
  item_id: phrase.id,
  distinct_session_count: 1,
  streak: 1,
  events: [
    {
      id: 1,
      item_type: 'phrase',
      item_id: phrase.id,
      session_id: 41,
      sequence: 3,
      origin: 'assessment',
      original_turn_time: NOW - 2 * DAY_MS,
      outcome: 'correct',
      exact_excerpt: 'we still need to figure out why the keys expire',
      confidence: 0.95,
      created_at: NOW - 2 * DAY_MS,
    },
    {
      id: 2,
      item_type: 'phrase',
      item_id: phrase.id,
      session_id: 40,
      sequence: 1,
      origin: 'assessment',
      original_turn_time: NOW - 5 * DAY_MS,
      outcome: 'with_help',
      exact_excerpt: 'I will figure out it tomorrow',
      confidence: 0.95,
      created_at: NOW - 5 * DAY_MS,
    },
    {
      id: 3,
      item_type: 'phrase',
      item_id: phrase.id,
      session_id: 39,
      sequence: 2,
      origin: 'assessment',
      original_turn_time: NOW - 6 * DAY_MS,
      outcome: 'uncertain',
      exact_excerpt: 'maybe I can figure something',
      confidence: 0.4,
      created_at: NOW - 6 * DAY_MS,
    },
  ],
};
