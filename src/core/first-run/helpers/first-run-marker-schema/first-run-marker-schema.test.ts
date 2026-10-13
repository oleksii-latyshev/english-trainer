import { describe, expect, it } from 'bun:test';
import { decodeFirstRunMarker } from './index';

describe('first run marker', () => {
  it('is pending unless a known status was stored', () => {
    for (const value of [undefined, null, 'finished', [], {}, { status: 'done' }]) {
      expect(decodeFirstRunMarker(value)).toEqual({ status: 'pending' });
    }
  });

  it('keeps a stored status and drops extra fields', () => {
    expect(decodeFirstRunMarker({ status: 'skipped' })).toEqual({ status: 'skipped' });
    expect(decodeFirstRunMarker({ status: 'finished', extra: 1 })).toEqual({ status: 'finished' });
  });
});
