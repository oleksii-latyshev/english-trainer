import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import {
  legacyDeviceStorage,
  PREFERRED_MICROPHONE_KEY,
  PreferredDeviceSchema,
  parsePreferredDeviceId,
} from '.';

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe('preferred microphone', () => {
  it('uses system default only when explicitly selected or the saved value is absent', () => {
    for (const value of [null, undefined, 123, {}, [], 'default', '  default  ', '']) {
      expect(parsePreferredDeviceId(value)).toBe('');
    }
    expect(parsePreferredDeviceId(' usb-microphone ')).toBe('usb-microphone');
  });

  it('decodes a stored value through the same rules', () => {
    const decode = Schema.decodeUnknownSync(PreferredDeviceSchema);
    expect(decode(' usb-microphone ')).toBe('usb-microphone');
    expect(decode('default')).toBe('');
    expect(decode(7)).toBe('');
  });

  it('reads the raw id earlier versions stored and passes JSON through', () => {
    const raw = memoryStorage({ [PREFERRED_MICROPHONE_KEY]: 'abc123' });
    const storage = legacyDeviceStorage(raw);
    expect(storage.getItem(PREFERRED_MICROPHONE_KEY)).toBe('"abc123"');
    storage.setItem(PREFERRED_MICROPHONE_KEY, '"abc123"');
    expect(raw.items.get(PREFERRED_MICROPHONE_KEY)).toBe('"abc123"');
    expect(storage.getItem(PREFERRED_MICROPHONE_KEY)).toBe('"abc123"');
    expect(storage.getItem('missing')).toBeNull();
  });
});
