import { describe, expect, it } from 'bun:test';
import { checkingLine } from './index';

describe('checkingLine', () => {
  it('stays quiet once every answer is checked', () => {
    expect(checkingLine(0, false)).toBe('');
  });

  it('counts the answers still being checked', () => {
    expect(checkingLine(1, false)).toBe('Still checking 1 answer…');
    expect(checkingLine(4, false)).toBe('Still checking 4 answers…');
  });

  it('says calmly that coaching is paused instead of waiting', () => {
    expect(checkingLine(0, true)).toContain('paused');
    expect(checkingLine(3, true)).toContain('paused');
  });
});
