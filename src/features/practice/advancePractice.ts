import type { ConversationTurn } from '@/lib/types';
import type { PracticeState } from './PracticeView';

export function advancePractice(
  current: PracticeState,
  sessionId: number,
  turn: ConversationTurn,
): PracticeState {
  if (current.tag !== 'active' || current.sessionId !== sessionId) return current;
  return {
    ...current,
    question: turn.question ?? current.question,
    turnCount: current.turnCount + 1,
  };
}
