import { describe, expect, it } from 'bun:test';
import { isJoinWindowOpen, JOIN_WINDOW_MS, joinAnswers } from '.';

describe('join window', () => {
  it('is open until the cap and closed from it', () => {
    expect(isJoinWindowOpen(1000, 1000 + JOIN_WINDOW_MS - 1)).toBe(true);
    expect(isJoinWindowOpen(1000, 1000 + JOIN_WINDOW_MS)).toBe(false);
  });

  it('joins two parts of one answer with a single space', () => {
    expect(joinAnswers('I went to ', ' the park.')).toBe('I went to the park.');
  });
});
