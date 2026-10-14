import { describe, expect, it } from 'bun:test';
import type { LearningMemory } from '@/core/learning-memory';
import { itemKey, statusBeforeOf } from './index';

describe('status before the review', () => {
  it('keys every phrase and mistake by its type and id', () => {
    const memory = {
      mistakes: [{ id: 3, status: 'new' }],
      phrase_cards: [{ id: 3, status: 'improving' }],
      due_count: 0,
    } as unknown as LearningMemory;
    const statuses = statusBeforeOf(memory);
    expect(statuses.get(itemKey('mistake', 3))).toBe('new');
    expect(statuses.get(itemKey('phrase', 3))).toBe('improving');
    expect(statuses.get(itemKey('phrase', 4))).toBeUndefined();
  });
});
