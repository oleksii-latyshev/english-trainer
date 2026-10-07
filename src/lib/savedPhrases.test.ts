// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type { PhraseCardRecord } from './learningTypes';
import { newlySavedCards } from './savedPhrases';

function card(id: number, createdAt: number): PhraseCardRecord {
  return {
    id,
    phrase: `phrase ${id}`,
    normalized_phrase: `phrase ${id}`,
    meaning_or_note: '',
    session_id: null,
    sequence: null,
    created_at: createdAt,
    last_reviewed_at: null,
    next_review_at: createdAt + 1,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'learning',
    is_due: false,
  };
}

describe('newlySavedCards', () => {
  it('keeps only cards created by this save', () => {
    const cards = [card(1, 1_000), card(2, 5_000), card(3, 5_001)];
    expect(newlySavedCards(cards, 5_000).map((item) => item.id)).toEqual([2, 3]);
  });

  it('returns nothing when every card already existed', () => {
    expect(newlySavedCards([card(1, 10)], 5_000)).toEqual([]);
  });
});
