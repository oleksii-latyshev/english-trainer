// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { EVA_MOOD_GUIDE, nextMoodIndex } from './evaMoods';

describe('Eva mood guide', () => {
  it('explains ten distinct faces', () => {
    expect(EVA_MOOD_GUIDE).toHaveLength(10);
    expect(new Set(EVA_MOOD_GUIDE.map((entry) => entry.mood)).size).toBe(10);
  });

  it('cycles back to the first face after the last', () => {
    expect(nextMoodIndex(0)).toBe(1);
    expect(nextMoodIndex(EVA_MOOD_GUIDE.length - 1)).toBe(0);
  });
});
