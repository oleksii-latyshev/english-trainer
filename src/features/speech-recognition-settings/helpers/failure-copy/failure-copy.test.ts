import { describe, expect, it } from 'bun:test';
import { AsyncResult } from 'effect/reactivity';
import { IpcDecodeError, IpcError } from '@/core/ipc';
import { settledFailureMessage } from '.';

describe('settledFailureMessage', () => {
  it('has nothing to say before and after a success', () => {
    expect(settledFailureMessage(AsyncResult.initial(), 'fallback')).toBeUndefined();
    expect(settledFailureMessage(AsyncResult.success(1), 'fallback')).toBeUndefined();
  });

  it('shows the message of a rejected command', () => {
    const failure = new IpcError({ code: 'invalid_request', message: 'Unknown model.' });
    expect(settledFailureMessage(AsyncResult.fail(failure), 'fallback')).toBe('Unknown model.');
  });

  it('falls back when the answer could not be decoded', () => {
    const failure = new IpcDecodeError({ command: 'save_speech_model', cause: 'bad' });
    expect(settledFailureMessage(AsyncResult.fail(failure), 'fallback')).toBe('fallback');
  });

  it('waits while a retry is running', () => {
    const failure = new IpcError({ code: 'invalid_request', message: 'Unknown model.' });
    const retrying = AsyncResult.waiting(AsyncResult.fail(failure));
    expect(settledFailureMessage(retrying, 'fallback')).toBeUndefined();
  });
});
