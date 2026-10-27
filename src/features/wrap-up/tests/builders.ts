import type { FinishedSession, PhraseCard, WrapupPhrase } from '../types';

export function aFinishedSession(overrides: Partial<FinishedSession> = {}): FinishedSession {
  return {
    session_id: 41,
    finished: true,
    turn_count: 3,
    target_turns: 8,
    duration_ms: 624_000,
    topic_label: 'Work & technology',
    duration_goal_seconds: 600,
    numbers: {
      speaking_time: { duration_ms: 90_000, trend: { kind: 'first' } },
      words_per_minute: { value: 110, trend: { kind: 'percent', change: 4 } },
      average_answer: { words: 22, trend: { kind: 'words', change: 3 } },
    },
    phrases: [],
    recurring_mistakes: [],
    pending_coaching: 0,
    is_coaching_paused: false,
    wrapup_preparation: { state: 'ready' },
    practice_mode: 'voice',
    practice_phase: 'speaking',
    written_turn_count: 0,
    spoken_turn_count: 3,
    is_mistake_practice: false,
    ...overrides,
  };
}

export function aPhrase(overrides: Partial<WrapupPhrase> = {}): WrapupPhrase {
  return {
    sequence: 1,
    phrase: 'It saves me time.',
    note: 'Use this to explain a practical benefit.',
    you_said: 'It make my work faster.',
    ...overrides,
  };
}

export function aCard(overrides: Partial<PhraseCard> = {}): PhraseCard {
  return {
    id: 500,
    phrase: 'It saves me time.',
    kind: 'phrase',
    normalized_phrase: 'it saves me time.',
    meaning_or_note: 'Use this to explain a practical benefit.',
    session_id: 41,
    sequence: 1,
    created_at: 2_000,
    last_reviewed_at: null,
    next_review_at: 2_000,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'new',
    is_due: true,
    times_used_on_own: 0,
    ...overrides,
  };
}
