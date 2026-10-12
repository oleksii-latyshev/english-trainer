import { describe, expect, it } from 'bun:test';
import { AsyncResult } from 'effect/reactivity';
import { naturalAvailability } from './index';

describe('natural availability', () => {
  it('is loading until the first answer', () => {
    expect(naturalAvailability(AsyncResult.initial())).toBe('loading');
  });

  it('is ready when the local voice answers yes', () => {
    expect(naturalAvailability(AsyncResult.success(true))).toBe('ready');
  });

  it('is unavailable when the local voice answers no or fails', () => {
    expect(naturalAvailability(AsyncResult.success(false))).toBe('unavailable');
    expect(naturalAvailability(AsyncResult.fail('boom'))).toBe('unavailable');
  });
});
