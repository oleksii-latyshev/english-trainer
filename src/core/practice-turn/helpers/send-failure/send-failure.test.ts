import { describe, expect, it } from 'bun:test';
import { IpcDecodeError, IpcError } from '@/core/ipc';
import { REPLY_UNAVAILABLE_MESSAGE, sendFailureOf } from '.';

describe('how a failed send reads', () => {
  it('needs setup only when the provider is missing or unauthorized', () => {
    expect(sendFailureOf(new IpcError({ code: 'unauthorized', message: 'Add a key.' }))).toEqual({
      message: 'Add a key.',
      needsSetup: true,
      isUnresponsive: false,
    });
  });

  it.each(['timeout', 'rate_limited', 'process_failed', 'invalid_output'] as const)(
    'marks %s as a model that did not answer',
    (code) => {
      expect(sendFailureOf(new IpcError({ code, message: 'Slow.' })).isUnresponsive).toBe(true);
    },
  );

  it('uses the plain sentence when the answer cannot be read', () => {
    const failure = sendFailureOf(new IpcDecodeError({ command: 'send_practice_turn', cause: 1 }));
    expect(failure.message).toBe(REPLY_UNAVAILABLE_MESSAGE);
    expect(failure.needsSetup).toBe(false);
  });

  it('falls back to the plain sentence for an empty message', () => {
    expect(sendFailureOf(new IpcError({ code: 'busy', message: ' ' })).message).toBe(
      REPLY_UNAVAILABLE_MESSAGE,
    );
  });
});
