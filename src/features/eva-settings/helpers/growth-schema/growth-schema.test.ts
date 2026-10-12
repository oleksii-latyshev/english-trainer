import { describe, expect, it } from 'bun:test';
import { decodeGrowth } from './index';

describe('growth schema', () => {
  it('shows growth unless it was switched off', () => {
    for (const value of [undefined, null, [], {}, { showGrowth: 'no' }]) {
      expect(decodeGrowth(value)).toEqual({ showGrowth: true });
    }
    expect(decodeGrowth({ showGrowth: false })).toEqual({ showGrowth: false });
  });
});
