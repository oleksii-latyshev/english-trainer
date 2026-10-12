import { describe, expect, it } from 'bun:test';
import { decodeDockIcon } from './index';

describe('dock icon schema', () => {
  it('falls back to Eva for anything unknown', () => {
    for (const value of [undefined, null, 'dark', [], {}, { icon: 'neon' }, { icon: 1 }]) {
      expect(decodeDockIcon(value)).toEqual({ icon: 'eva' });
    }
  });

  it('keeps a known icon', () => {
    expect(decodeDockIcon({ icon: 'dark' })).toEqual({ icon: 'dark' });
    expect(decodeDockIcon({ icon: 'light' })).toEqual({ icon: 'light' });
  });
});
