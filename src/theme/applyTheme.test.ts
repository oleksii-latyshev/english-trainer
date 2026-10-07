// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, test } from 'bun:test';
import { resolveTheme } from './applyTheme';

describe('resolveTheme', () => {
  test('follows the system when no explicit choice is made', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  test('an explicit choice wins over the system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
