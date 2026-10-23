import type { ConversationTurn } from '@/core/ipc';
import type { InputSource } from '@/core/practice-session';

export function spokenTurn(turn: Pick<ConversationTurn, 'question' | 'spoken_reply'>): string {
  return turn.question ? `${turn.spoken_reply} ${turn.question}` : turn.spoken_reply;
}

export function spokenDurationMs(
  source: InputSource | undefined,
  recordingMs: number,
): number | undefined {
  if (source === undefined || source === 'text' || !(recordingMs > 0)) return undefined;
  return Math.round(recordingMs);
}
