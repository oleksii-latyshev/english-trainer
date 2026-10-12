import { expect, it } from 'bun:test';
import { IpcDecodeError, IpcError } from '@/core/ipc';
import { providerInstructions, SAMPLE_SENTENCE, testFailureMessage, UNREADABLE_REPLY } from '.';

it('names the sample sentence and where it goes for every provider', () => {
  for (const provider of ['gemini', 'apple', 'agy', null] as const) {
    expect(providerInstructions(provider)).toContain(SAMPLE_SENTENCE);
  }
  expect(providerInstructions('apple')).toContain('Apple Intelligence');
  expect(providerInstructions('gemini')).toContain('saved key');
  expect(providerInstructions('agy')).toContain('sign in');
  expect(providerInstructions(null)).toContain('your saved conversation provider');
});

it('shows the backend message, which says how to recover', () => {
  const failure = new IpcError({ code: 'unauthorized', message: 'No Gemini API key is set.' });
  expect(testFailureMessage(failure, 'gemini')).toBe('No Gemini API key is set.');
});

it('falls back to provider-specific advice when the message is blank', () => {
  const blank = new IpcError({ code: 'process_failed', message: ' ' });
  expect(testFailureMessage(blank, 'gemini')).toContain('API key');
  expect(testFailureMessage(blank, 'apple')).toContain('Apple Intelligence');
  expect(testFailureMessage(blank, 'agy')).toContain('agy setup');
  expect(testFailureMessage(blank, null)).toContain('conversation AI settings');
});

it('says the reply could not be read when it does not match the contract', () => {
  const failure = new IpcDecodeError({ command: 'generate_follow_up', cause: 'x' });
  expect(testFailureMessage(failure, 'gemini')).toBe(UNREADABLE_REPLY);
});
