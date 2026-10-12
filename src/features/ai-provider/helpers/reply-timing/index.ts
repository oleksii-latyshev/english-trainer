import type { ConversationTurn } from '@/core/ipc';

export type ReplyTiming = { readonly firstWords: string; readonly fullReply: string };

export function formatSeconds(milliseconds: number, decimals: 1 | 2): string {
  return `${(milliseconds / 1000).toFixed(decimals)} s`;
}

export function replyTiming(turn: ConversationTurn): ReplyTiming | null {
  if (turn.provider_latency_ms === undefined) return null;
  return {
    firstWords: formatSeconds(turn.first_token_ms ?? turn.provider_latency_ms, 2),
    fullReply: formatSeconds(turn.provider_latency_ms, 1),
  };
}
