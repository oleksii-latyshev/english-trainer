import type { ConversationTurn } from '@/lib/types';

export type SessionDetails = {
  sessionId: number;
  question: string;
  turnCount: number;
  targetTurns: number;
};

export type PracticeState =
  | { tag: 'idle' }
  | { tag: 'loading' }
  | { tag: 'starting' }
  | ({ tag: 'active' | 'waiting' | 'finishing' } & SessionDetails);

export function sessionDetails(state: PracticeState): SessionDetails | undefined {
  if (state.tag === 'idle' || state.tag === 'loading' || state.tag === 'starting') return undefined;
  return state;
}

export function advancePractice(
  current: PracticeState,
  sessionId: number,
  turn: ConversationTurn,
): PracticeState {
  if (current.tag !== 'active' && current.tag !== 'waiting') return current;
  if (current.sessionId !== sessionId) return current;
  return {
    ...current,
    question: turn.question ?? current.question,
    turnCount: current.turnCount + 1,
  };
}

export function setTurnPending(current: PracticeState, isPending: boolean): PracticeState {
  if (isPending && current.tag === 'active') return { ...current, tag: 'waiting' };
  if (!isPending && current.tag === 'waiting') return { ...current, tag: 'active' };
  return current;
}
