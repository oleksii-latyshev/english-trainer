import { expect, it } from 'bun:test';
import { IpcDecodeError, IpcError } from '@/core/ipc';
import { keyErrorMessage } from '.';

it('explains an implausible key and where to copy a good one from', () => {
  const failure = new IpcError({ code: 'invalid_request', message: 'ignored' });
  expect(keyErrorMessage(failure)).toBe(
    'That does not look like a Gemini API key. Copy it again from Google AI Studio.',
  );
});

it('tells the learner to paste the key again when it cannot be read', () => {
  const unreadable = new IpcError({ code: 'unauthorized', message: 'ignored' });
  const inaccessible = new IpcError({ code: 'unavailable', message: 'ignored' });
  expect(keyErrorMessage(unreadable)).toContain('cannot be read on this computer');
  expect(keyErrorMessage(inaccessible)).toContain('Could not access the saved Gemini API key');
});

it('chooses copy from the code, never from the message text', () => {
  const failure = new IpcError({ code: 'invalid_request', message: 'No Gemini API key is set.' });
  expect(keyErrorMessage(failure)).not.toContain('No Gemini API key');
});

it('falls back to a generic retry message for other codes and undecodable answers', () => {
  const fallback = 'Could not update the Gemini API key. Please try again.';
  expect(keyErrorMessage(new IpcError({ code: 'process_failed', message: 'x' }))).toBe(fallback);
  expect(keyErrorMessage(new IpcDecodeError({ command: 'save_gemini_api_key', cause: 'x' }))).toBe(
    fallback,
  );
});
