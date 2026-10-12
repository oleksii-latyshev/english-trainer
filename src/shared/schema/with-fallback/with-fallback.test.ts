import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { withFallback } from './index';

const Fields = Schema.Struct({ enabled: withFallback(Schema.Boolean, true) });
const decode = Schema.decodeUnknownSync(Fields);

describe('withFallback', () => {
  it('keeps a valid value', () => {
    expect(decode({ enabled: false })).toEqual({ enabled: false });
  });

  it('replaces an invalid value with the fallback', () => {
    expect(decode({ enabled: 'yes' })).toEqual({ enabled: true });
  });

  it('fills a missing key with the fallback', () => {
    expect(decode({})).toEqual({ enabled: true });
  });
});
