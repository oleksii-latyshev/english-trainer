import { invoke } from '@tauri-apps/api/core';
import { createReplyChannel } from '@/lib/replyStream';
import { isConversationTurn } from '@/lib/types';

const SAMPLE_SENTENCE = 'I am testing my English practice setup.';

/**
 * Sends one short practice sentence through the saved provider and returns the time to Eva's first
 * words in milliseconds, or undefined when the reply carries no timing.
 */
export async function measureFirstWords(): Promise<number | undefined> {
  const result: unknown = await invoke<unknown>('generate_follow_up', {
    transcript: SAMPLE_SENTENCE,
    onReply: createReplyChannel(() => {}),
  });
  if (!isConversationTurn(result)) {
    throw new Error('The provider returned a reply the app could not read.');
  }
  return result.first_token_ms ?? result.provider_latency_ms;
}
