import { describe, expect, it } from 'bun:test';
import { endLabelOf, pipStateOf, progressLabel } from './index';

describe('review header', () => {
  it('marks the pips before the current item done and the ones after it ahead', () => {
    expect([0, 1, 2].map((index) => pipStateOf(index, 2))).toEqual(['done', 'current', 'ahead']);
    expect([0, 1].map((index) => pipStateOf(index, null))).toEqual(['done', 'done']);
  });

  it('counts the current item, or says the review is done', () => {
    expect(progressLabel(2, 6)).toBe('2 of 6');
    expect(progressLabel(null, 6)).toBe('Done');
  });

  it('words the way out for a review and for a warm-up', () => {
    expect(endLabelOf({ isWarmup: false, isDone: false })).toBe('End review');
    expect(endLabelOf({ isWarmup: false, isDone: true })).toBe('Back to Memory');
    expect(endLabelOf({ isWarmup: true, isDone: false })).toBe('Skip and start conversation');
    expect(endLabelOf({ isWarmup: true, isDone: true })).toBe('Start conversation');
  });
});
