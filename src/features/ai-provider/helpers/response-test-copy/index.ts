import type { ConversationProvider } from '@/core/ipc';
import type { ResponseTestFailure } from '../../types';

export const SAMPLE_SENTENCE = 'I am testing my English practice setup.';

const SENT_TO = `Sends “${SAMPLE_SENTENCE}” to`;

const FAILURE_FOR_PROVIDER: Record<ConversationProvider, string> = {
  gemini: 'The Gemini test failed. Check the API key and your internet connection, then try again.',
  apple: 'The Apple provider test failed. Check Apple Intelligence setup and try again.',
  agy: 'The provider test failed. Check the agy setup and try again.',
};

const FAILURE_FOR_UNKNOWN_PROVIDER =
  'The configured provider test failed. Check conversation AI settings and try again.';

export const UNREADABLE_REPLY =
  'The provider returned a response the app could not read. Check setup and try again.';

export function providerInstructions(provider: ConversationProvider | null): string {
  switch (provider) {
    case 'apple':
      return `${SENT_TO} Apple on-device. It needs macOS 26+, Apple Intelligence enabled in System Settings, and the on-device models downloaded.`;
    case 'gemini':
      return `${SENT_TO} the Gemini API with your saved key.`;
    case 'agy':
      return `${SENT_TO} Antigravity CLI. A found agy command does not prove you are signed in; if the test fails, sign in using its setup flow (README, Personal Alpha setup).`;
    case null:
      return `${SENT_TO} your saved conversation provider.`;
    default:
      return provider satisfies never;
  }
}

export function testFailureMessage(
  failure: ResponseTestFailure,
  provider: ConversationProvider | null,
): string {
  if (failure._tag === 'IpcDecodeError') return UNREADABLE_REPLY;
  if (failure.message.trim().length > 0) return failure.message;
  return provider === null ? FAILURE_FOR_UNKNOWN_PROVIDER : FAILURE_FOR_PROVIDER[provider];
}
