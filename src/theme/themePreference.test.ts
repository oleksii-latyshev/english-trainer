// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { parseAppearance } from './themePreference';

describe('appearance preference', () => {
  it('follows the system unless a known theme is stored', () => {
    for (const value of [undefined, null, 'dark', [], { theme: 'sepia' }, { theme: 3 }]) {
      expect(parseAppearance(value)).toEqual({ theme: 'system' });
    }
  });

  it('keeps an explicit choice', () => {
    expect(parseAppearance({ theme: 'light' })).toEqual({ theme: 'light' });
    expect(parseAppearance({ theme: 'dark' })).toEqual({ theme: 'dark' });
  });
});
