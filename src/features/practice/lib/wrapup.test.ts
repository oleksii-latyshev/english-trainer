// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { checkingLine, formatDuration, savePhrasesLabel, trendLine } from './wrapup';

describe('formatDuration', () => {
  it('writes minutes and seconds without empty units', () => {
    expect(formatDuration(624_000)).toBe('10 min 24 s');
    expect(formatDuration(290_000)).toBe('4 min 50 s');
    expect(formatDuration(240_000)).toBe('4 min');
    expect(formatDuration(24_400)).toBe('24 s');
    expect(formatDuration(0)).toBe('0 s');
    expect(formatDuration(3_900_000)).toBe('1 h 5 min');
    expect(formatDuration(3_600_000)).toBe('1 h');
  });

  it('rounds to the nearest second', () => {
    expect(formatDuration(59_600)).toBe('1 min');
  });
});

describe('trendLine', () => {
  it('describes growth in the accent tone', () => {
    expect(trendLine({ kind: 'percent', change: 12 })).toEqual({
      text: '+12% vs last session',
      tone: 'positive',
    });
    expect(trendLine({ kind: 'words', change: 5 })).toEqual({
      text: '+5 words vs last session',
      tone: 'positive',
    });
    expect(trendLine({ kind: 'words', change: 1 }).text).toBe('+1 word vs last session');
  });

  it('keeps drops and steady numbers quiet', () => {
    expect(trendLine({ kind: 'percent', change: -8 })).toEqual({
      text: '−8% vs last session',
      tone: 'quiet',
    });
    expect(trendLine({ kind: 'same' }).text).toBe('about the same as usual');
    expect(trendLine({ kind: 'first' }).text).toBe('first session with this measure');
  });
});

describe('savePhrasesLabel', () => {
  it('counts the phrases left', () => {
    expect(savePhrasesLabel(1)).toBe('Save 1 phrase to Memory');
    expect(savePhrasesLabel(3)).toBe('Save all 3 phrases to Memory');
  });
});

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
