import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { MicrophoneError } from '@/core/audio';
import { settle, settleSync } from './settle';

const failure = new MicrophoneError({ reason: 'not-ready', message: 'Not ready.' });

describe('settle', () => {
  it('rejects with the microphone error so callers can show its message', async () => {
    const rejection = await settle(Effect.fail(failure)).catch((error: unknown) => error);
    expect(rejection).toBe(failure);
  });

  it('resolves with the value of a successful effect', async () => {
    expect(await settle(Effect.succeed(3))).toBe(3);
    expect(settleSync(Effect.succeed(4))).toBe(4);
  });

  it('throws the microphone error from a synchronous run', () => {
    expect(() => settleSync(Effect.fail(failure))).toThrow('Not ready.');
  });
});
