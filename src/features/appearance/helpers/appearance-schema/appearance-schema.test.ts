import { describe, expect, it } from 'bun:test';
import { decodeAppearance } from './index';

describe('appearance schema', () => {
  it('follows the system unless a known theme is stored', () => {
    for (const value of [undefined, null, 'dark', [], {}, { theme: 'sepia' }, { theme: 3 }]) {
      expect(decodeAppearance(value)).toEqual({ theme: 'system' });
    }
  });

  it('keeps an explicit choice', () => {
    expect(decodeAppearance({ theme: 'light' })).toEqual({ theme: 'light' });
    expect(decodeAppearance({ theme: 'dark' })).toEqual({ theme: 'dark' });
  });
});
