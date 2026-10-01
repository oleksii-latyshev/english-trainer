import type {
  AttemptComparison,
  ConversationTurn,
  FinishedPracticeSession,
  SavedCoachState,
  SessionMode,
  TurnFeedback,
} from '@/lib/types';

export type SessionDetails = {
  sessionId: number;
  mode: SessionMode;
  question: string;
  turnCount: number;
  targetTurns: number;
  retryEvidence: AttemptComparison[];
  coachState?: SavedCoachState | null;
};

export type PracticeState =
  | { tag: 'idle' }
  | { tag: 'loading' }
  | { tag: 'starting' }
  | { tag: 'completed'; summary: FinishedPracticeSession }
  | ({ tag: 'active' | 'waiting' | 'finishing' } & SessionDetails);

export function sessionDetails(state: PracticeState): SessionDetails | undefined {
  if (
    state.tag === 'idle' ||
    state.tag === 'loading' ||
    state.tag === 'starting' ||
    state.tag === 'completed'
  )
    return undefined;
  return state;
}

export function advancePractice(
  current: PracticeState,
  sessionId: number,
  transcript: string,
  turn: ConversationTurn,
): PracticeState {
  if (current.tag !== 'active' && current.tag !== 'waiting') return current;
  if (current.sessionId !== sessionId) return current;
  const newTurnCount = current.turnCount + 1;
  return {
    ...current,
    question: turn.question ?? current.question,
    turnCount: newTurnCount,
    coachState: {
      session_id: current.sessionId,
      sequence: newTurnCount,
      answered_question: current.question,
      original_transcript: transcript,
      feedback: null,
      is_pending: false,
    },
  };
}

export function recordCoachAnswer(
  current: PracticeState,
  sessionId: number,
  coachState: SavedCoachState,
): PracticeState {
  if (current.tag !== 'active' && current.tag !== 'waiting') return current;
  if (current.sessionId !== sessionId) return current;
  return {
    ...current,
    tag: 'active',
    turnCount: coachState.sequence,
    coachState,
  };
}

export function advanceCoachTurn(
  current: PracticeState,
  sessionId: number,
  turn: ConversationTurn,
): PracticeState {
  if (current.tag !== 'active' && current.tag !== 'waiting') return current;
  if (current.sessionId !== sessionId) return current;
  return {
    ...current,
    tag: 'active',
    question: turn.question ?? current.question,
    coachState: current.coachState
      ? {
          ...current.coachState,
          is_pending: false,
        }
      : null,
  };
}

export function updateCoachFeedback(
  current: PracticeState,
  sessionId: number,
  sequence: number,
  feedback: TurnFeedback,
): PracticeState {
  if (current.tag !== 'active' && current.tag !== 'waiting') return current;
  if (current.sessionId !== sessionId) return current;
  if (!current.coachState || current.coachState.sequence !== sequence) return current;
  return {
    ...current,
    coachState: {
      ...current.coachState,
      feedback,
    },
  };
}

export function setTurnPending(current: PracticeState, isPending: boolean): PracticeState {
  if (isPending && current.tag === 'active') return { ...current, tag: 'waiting' };
  if (!isPending && current.tag === 'waiting') return { ...current, tag: 'active' };
  return current;
}

export function recordRetryComparison(
  current: PracticeState,
  sessionId: number,
  comparison: AttemptComparison,
): PracticeState {
  if (current.tag !== 'active' && current.tag !== 'waiting') return current;
  if (current.sessionId !== sessionId) return current;
  return {
    ...current,
    retryEvidence: [
      ...current.retryEvidence.filter((item) => item.turn_sequence !== comparison.turn_sequence),
      comparison,
    ].sort((a, b) => a.turn_sequence - b.turn_sequence),
  };
}
