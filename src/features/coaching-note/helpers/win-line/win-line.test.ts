import { describe, expect, it } from 'bun:test';
import { winLine, wonPhrases } from '.';

describe('winLine', () => {
  it('marks a taken word used on the learner’s own', () => {
    expect(winLine('look into')).toBe('✓ Used on your own: look into');
  });
});

describe('wonPhrases', () => {
  it('lists each phrase once whatever its case, in answer order', () => {
    expect(
      wonPhrases([{ phrase: 'Look into' }, { phrase: 'figure out' }, { phrase: 'look into' }]),
    ).toEqual(['Look into', 'figure out']);
  });

  it('is empty without wins', () => {
    expect(wonPhrases([])).toEqual([]);
  });
});
