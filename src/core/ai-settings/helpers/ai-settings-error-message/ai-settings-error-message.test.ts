import { expect, it } from 'bun:test';
import { IpcDecodeError, IpcError } from '@/core/ipc';
import { aiSettingsErrorMessage } from '.';

const FALLBACK = 'Could not save. Please try again.';

it('shows the backend message, which already says how to recover', () => {
  const failure = new IpcError({ code: 'unauthorized', message: 'Add a key in Settings.' });
  expect(aiSettingsErrorMessage(failure, FALLBACK)).toBe('Add a key in Settings.');
});

it('falls back when the message is blank or the answer could not be decoded', () => {
  const blank = new IpcError({ code: 'database_error', message: '  ' });
  expect(aiSettingsErrorMessage(blank, FALLBACK)).toBe(FALLBACK);
  expect(
    aiSettingsErrorMessage(
      new IpcDecodeError({ command: 'get_ai_settings', cause: 'x' }),
      FALLBACK,
    ),
  ).toBe(FALLBACK);
});
