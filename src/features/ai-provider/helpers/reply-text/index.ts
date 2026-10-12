import type { ConversationTurn } from '@/core/ipc';

export function replyText(turn: ConversationTurn): string {
  return turn.question ? `${turn.spoken_reply}\n\n${turn.question}` : turn.spoken_reply;
}
