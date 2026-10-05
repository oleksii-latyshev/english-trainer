// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { createCaptureStartup } from './captureStartup';

describe('capture startup', () => {
  it('stays starting before input frames arrive, including empty callbacks', () => {
    const startup = createCaptureStartup(48_000);
    expect(startup.accept(0)).toBe(false);
    expect(startup.accept(128)).toBe(false);
  });

  it('waits for input warmup even when the audio context is already running', () => {
    const startup = createCaptureStartup(16_000);
    expect(startup.accept(12_000)).toBe(false);
    expect(startup.accept(35_999)).toBe(false);
    expect(startup.accept(1)).toBe(true);
  });

  it('does not require speech and handles different hardware sample rates', () => {
    const startup = createCaptureStartup(44_100);
    expect(startup.accept(44_100)).toBe(false);
    expect(startup.accept(44_100)).toBe(false);
    expect(startup.accept(44_100)).toBe(true);
    expect(startup.accept(128)).toBe(true);
  });
});
