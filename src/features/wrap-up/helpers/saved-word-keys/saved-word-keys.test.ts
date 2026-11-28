import { describe, expect, it } from 'bun:test';
import { aCard } from '../../tests/builders';
import { wordKey } from '../word-key';
import { savedWordKeys } from './index';

describe('savedWordKeys', () => {
  it('keys each saved card by its session, answer and phrase', () => {
    const keys = savedWordKeys([aCard({ session_id: 41, sequence: 2, phrase: 'For two years' })]);
    expect(keys.has(wordKey(41, { sequence: 2, phrase: 'for two years' }))).toBe(true);
    expect(keys.has(wordKey(42, { sequence: 2, phrase: 'for two years' }))).toBe(false);
  });

  it('ignores cards that did not come from an answer', () => {
    const keys = savedWordKeys([
      aCard({ session_id: null, sequence: null }),
      aCard({ sequence: null }),
    ]);
    expect(keys.size).toBe(0);
  });
});
