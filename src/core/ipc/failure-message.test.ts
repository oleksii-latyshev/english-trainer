import { expect, it } from 'bun:test';
import { IpcDecodeError, IpcError } from './errors';
import { ipcFailureMessage } from './failure-message';

const FALLBACK = 'Could not finish. Please try again.';

it('shows the backend message, which already says how to recover', () => {
  const failure = new IpcError({ code: 'unavailable', message: 'Prepare the languages first.' });
  expect(ipcFailureMessage(failure, FALLBACK)).toBe('Prepare the languages first.');
});

it('falls back when the message is blank or the answer could not be decoded', () => {
  const blank = new IpcError({ code: 'database_error', message: '  ' });
  expect(ipcFailureMessage(blank, FALLBACK)).toBe(FALLBACK);
  expect(ipcFailureMessage(new IpcDecodeError({ command: 'x', cause: 'y' }), FALLBACK)).toBe(
    FALLBACK,
  );
});
