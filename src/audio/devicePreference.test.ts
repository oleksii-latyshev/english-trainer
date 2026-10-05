// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  getPreferredDeviceId,
  getStorageStatus,
  parsePreferredDeviceId,
  setPreferredDeviceId,
  subscribeDevicePreference,
} from './devicePreference';

describe('microphone preference', () => {
  it('uses system default only when explicitly selected or the saved value is absent', () => {
    for (const value of [null, undefined, 123, {}, [], 'default', '  default  ', '']) {
      expect(parsePreferredDeviceId(value)).toBe('');
    }
    expect(parsePreferredDeviceId(' usb-microphone ')).toBe('usb-microphone');
  });
  it('notifies all capture consumers and allows unsubscribing', () => {
    let count = 0;
    const unsubscribe = subscribeDevicePreference(() => {
      count += 1;
    });
    setPreferredDeviceId('usb-microphone');
    expect(getPreferredDeviceId()).toBe('usb-microphone');
    expect(count).toBe(1);
    unsubscribe();
    setPreferredDeviceId('');
    expect(count).toBe(1);
  });
  it('keeps selection usable and explains that persistence is unavailable without a browser', () => {
    setPreferredDeviceId('session-microphone');
    expect(getPreferredDeviceId()).toBe('session-microphone');
    expect(getStorageStatus().available).toBe(false);
    expect(getStorageStatus().warning).toContain('current session');
  });
});
