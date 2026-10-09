import type { AttemptComparison, ConversationTurn, FinishedPracticeSession } from '@/lib/types';

export type SessionDetails = {
  sessionId: number;
  question: string;
  turnCount: number;
  targetTurns: number;
  retryEvidence: AttemptComparison[];
  topicId: string;
  topicLabel: string;
  topicCustom: string | null;
  durationGoalSeconds: 300 | 600 | 900;
  activeDurationMs: number;
  startedAt: number;
  isClockRunning: boolean;
  clockSnapshotAtMs: number;
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
  turn: ConversationTurn,
): PracticeState {
  if (current.tag !== 'active' && current.tag !== 'waiting') return current;
  if (current.sessionId !== sessionId) return current;
  return {
    ...current,
    question: turn.question ?? turn.spoken_reply,
    turnCount: current.turnCount + 1,
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

/** The wrap-up as it stands after more coaching landed; another session's update is ignored. */
export function updateSummary(
  current: PracticeState,
  summary: FinishedPracticeSession,
): PracticeState {
  if (current.tag !== 'completed' || current.summary.session_id !== summary.session_id) {
    return current;
  }
  return { tag: 'completed', summary };
}

/** Applies only a matching session's clock snapshot; turn state stays owned by its latest reply. */
export function updatePracticeClock(
  current: PracticeState,
  session: import('@/lib/practiceSessionTypes').PracticeSession,
): PracticeState {
  if (
    (current.tag !== 'active' && current.tag !== 'waiting' && current.tag !== 'finishing') ||
    current.sessionId !== session.session_id
  )
    return current;
  return {
    ...current,
    topicId: session.topic_id,
    topicLabel: session.topic_label,
    topicCustom: session.topic_custom,
    durationGoalSeconds: session.duration_goal_seconds,
    activeDurationMs: session.active_duration_ms,
    startedAt: session.started_at,
    isClockRunning: session.is_clock_running,
    clockSnapshotAtMs: performance.now(),
  };
}
