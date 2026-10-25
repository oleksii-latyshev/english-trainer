import type { ConversationTurn } from '@/core/ipc';
import type {
  AttemptComparison,
  PracticeSession,
  PracticeState,
  SessionDetails,
} from '../../types';

export function sessionDetails(state: PracticeState): SessionDetails | undefined {
  switch (state.tag) {
    case 'idle':
    case 'loading':
    case 'starting':
    case 'completed':
      return undefined;
    case 'active':
    case 'waiting':
    case 'finishing':
      return state;
  }
}

export function isSessionOpen(state: PracticeState): boolean {
  return state.tag === 'active' || state.tag === 'waiting' || state.tag === 'finishing';
}

export function isSessionBusy(state: PracticeState): boolean {
  return state.tag === 'loading' || state.tag === 'starting' || state.tag === 'finishing';
}

function writtenAfterTurn(current: SessionDetails): number {
  const isWriting =
    current.practiceMode === 'text_chat' ||
    (current.practiceMode === 'write_then_speak' && current.practicePhase === 'writing');
  return isWriting ? current.writtenTurnCount + 1 : current.writtenTurnCount;
}

function spokenAfterTurn(current: SessionDetails): number {
  const isSpeaking =
    current.practiceMode === 'voice' ||
    (current.practiceMode === 'write_then_speak' && current.practicePhase === 'speaking');
  return isSpeaking ? current.spokenTurnCount + 1 : current.spokenTurnCount;
}

export function advancePractice(
  current: PracticeState,
  sessionId: number,
  turn: Pick<ConversationTurn, 'question' | 'spoken_reply'>,
): PracticeState {
  if (current.tag !== 'active' && current.tag !== 'waiting') return current;
  if (current.sessionId !== sessionId) return current;
  return {
    ...current,
    question: turn.question ?? turn.spoken_reply,
    turnCount: current.turnCount + 1,
    writtenTurnCount: writtenAfterTurn(current),
    spokenTurnCount: spokenAfterTurn(current),
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
  const others = current.retryEvidence.filter(
    (item) => item.turn_sequence !== comparison.turn_sequence,
  );
  return {
    ...current,
    retryEvidence: [...others, comparison].sort((a, b) => a.turn_sequence - b.turn_sequence),
  };
}

export function updatePracticeClock(
  current: PracticeState,
  session: PracticeSession,
  nowMs: number,
): PracticeState {
  const isOpen =
    current.tag === 'active' || current.tag === 'waiting' || current.tag === 'finishing';
  if (!isOpen || current.sessionId !== session.session_id) return current;
  return {
    ...current,
    topicId: session.topic_id,
    topicLabel: session.topic_label,
    topicCustom: session.topic_custom,
    durationGoalSeconds: session.duration_goal_seconds,
    activeDurationMs: session.active_duration_ms,
    startedAt: session.started_at,
    isClockRunning: session.is_clock_running,
    isMistakePractice: session.is_mistake_practice,
    clockSnapshotAtMs: nowMs,
  };
}
