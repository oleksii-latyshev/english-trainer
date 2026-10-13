import { describe, expect, it } from 'bun:test';
import { AsyncResult } from 'effect/reactivity';
import type { LearningMemoryView, MistakeRecord, PhraseCardRecord } from '@/core/ipc';
import { dueMemory } from './index';

function phrase(overrides: Partial<PhraseCardRecord> = {}): PhraseCardRecord {
  return {
    id: 1,
    phrase: 'figure out',
    normalized_phrase: 'figure out',
    meaning_or_note: '',
    session_id: null,
    sequence: null,
    created_at: 1,
    last_reviewed_at: null,
    next_review_at: 1,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'learning',
    is_due: false,
    times_used_on_own: 0,
    ...overrides,
  };
}

function mistake(id: number, timesSeen: number): MistakeRecord {
  return {
    id,
    normalized_key: `key-${id}`,
    category: 'grammar',
    original_example: `wrong ${id}`,
    corrected_example: `right ${id}`,
    explanation: 'Because.',
    times_seen: timesSeen,
    times_correct_afterwards: 0,
    last_seen_at: 1,
    last_reviewed_at: null,
    next_review_at: 1,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'learning',
    is_due: false,
  };
}

function ready(view: Partial<LearningMemoryView>) {
  return AsyncResult.success({ mistakes: [], phrase_cards: [], due_count: 0, ...view });
}

describe('dueMemory', () => {
  it('is loading until the first answer and unavailable when it fails', () => {
    expect(dueMemory(AsyncResult.initial()).tag).toBe('loading');
    expect(dueMemory(AsyncResult.failure({ _tag: 'IpcError' } as never)).tag).toBe('unavailable');
  });

  it('offers the first due phrase and the due count', () => {
    const result = dueMemory(
      ready({
        due_count: 2,
        phrase_cards: [phrase({ id: 1 }), phrase({ id: 2, is_due: true }), phrase({ id: 3 })],
      }),
    );
    expect(result).toMatchObject({ tag: 'ready', dueCount: 2 });
    expect(result.tag === 'ready' && result.nextDuePhrase?.id).toBe(2);
  });

  it('shows the three most repeated practicable mistakes', () => {
    const result = dueMemory(
      ready({
        mistakes: [mistake(1, 2), mistake(2, 9), mistake(3, 1), mistake(4, 5), mistake(5, 3)],
      }),
    );
    expect(result.tag === 'ready' && result.usualMistakes.map((item) => item.id)).toEqual([
      2, 4, 5,
    ]);
  });
});
