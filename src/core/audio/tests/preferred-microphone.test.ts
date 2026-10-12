import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { appRegistry } from '@/core/runtime';
import { PREFERRED_MICROPHONE_KEY } from '../helpers/preferred-device';
import { preferredMicrophoneAtom, readPreferredMicrophone } from '../model/preferred-microphone';

function memoryStorage(initial: Record<string, string>) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const storage = memoryStorage({ [PREFERRED_MICROPHONE_KEY]: 'usb-microphone-id' });

describe('remembered microphone', () => {
  beforeAll(() => {
    Reflect.set(globalThis, 'window', { localStorage: storage });
  });

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('reads the plain id earlier versions stored', () => {
    expect(readPreferredMicrophone()).toBe('usb-microphone-id');
  });

  it('remembers a new choice and reads it back after a restart', () => {
    appRegistry.set(preferredMicrophoneAtom, 'airpods-id');
    expect(readPreferredMicrophone()).toBe('airpods-id');
    expect(storage.items.get(PREFERRED_MICROPHONE_KEY)).toBe('"airpods-id"');
  });

  it('falls back to the system default when the choice is cleared', () => {
    appRegistry.set(preferredMicrophoneAtom, '');
    expect(readPreferredMicrophone()).toBe('');
  });
});
