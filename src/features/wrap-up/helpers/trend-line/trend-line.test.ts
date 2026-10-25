import { describe, expect, it } from 'bun:test';
import { trendLine } from './index';

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
