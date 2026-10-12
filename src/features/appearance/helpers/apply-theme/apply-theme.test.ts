import { describe, expect, it } from 'bun:test';
import { resolveTheme } from './index';

describe('resolveTheme', () => {
  it('follows the system appearance', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('lets an explicit choice win over the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
