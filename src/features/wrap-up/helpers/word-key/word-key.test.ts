import { describe, expect, it } from 'bun:test';
import { wordKey } from '.';

describe('wordKey', () => {
  it('names a word by session, answer and its phrase whatever the case', () => {
    expect(wordKey(41, { sequence: 2, phrase: ' Back Up ' })).toBe('41:2:back up');
  });

  it('tells the same phrase of two answers apart', () => {
    expect(wordKey(41, { sequence: 1, phrase: 'agenda' })).not.toBe(
      wordKey(41, { sequence: 2, phrase: 'agenda' }),
    );
  });
});
