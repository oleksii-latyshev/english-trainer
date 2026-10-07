import { invoke } from '@tauri-apps/api/core';
import { createReplyChannel } from '@/lib/replyStream';
import { type ConversationTurn, isProviderError, type ProviderErrorCode } from '@/lib/types';

export type FollowUpState =
  | { tag: 'idle' }
  | { tag: 'thinking' }
  | {
      tag: 'ready';
      turn: ConversationTurn;
      sentAtMs: number;
      replyAtMs: number;
      audioAtMs?: number;
      voiceStartMs?: number;
    }
  | { tag: 'error'; code: ProviderErrorCode | 'unknown'; message: string };

export function spokenTurn(turn: ConversationTurn): string {
  return turn.question ? `${turn.spoken_reply} ${turn.question}` : turn.spoken_reply;
}

export function followUpError(cause: unknown): Extract<FollowUpState, { tag: 'error' }> {
  if (isProviderError(cause)) return { tag: 'error', code: cause.code, message: cause.message };
  return {
    tag: 'error',
    code: 'unknown',
    message: 'The AI follow-up could not be generated. Please try again.',
  };
}

export type InputSource = 'voice' | 'edited' | 'text';

export function requestTurn(
  sessionId: number | undefined,
  transcript: string,
  inputSource: InputSource = 'text',
  onDelta: (text: string) => void = () => {},
): Promise<unknown> {
  const onReply = createReplyChannel(onDelta);
  if (sessionId === undefined)
    return invoke<unknown>('generate_follow_up', { transcript, onReply });
  return invoke<unknown>('send_practice_turn', {
    sessionId,
    transcript,
    inputSource,
    onReply,
  });
}
