import type { PracticeMode, PracticePhase, PracticeSession, SessionDetails } from '../../types';

const DEFAULT_MODE: PracticeMode = 'voice';

function defaultPhase(mode: PracticeMode): PracticePhase {
  return mode === 'voice' ? 'speaking' : 'writing';
}

export function practiceModeOf(session: PracticeSession): PracticeMode {
  return session.practice_mode ?? DEFAULT_MODE;
}

export function practicePhaseOf(session: PracticeSession): PracticePhase {
  return session.practice_phase ?? defaultPhase(practiceModeOf(session));
}

export function writtenTurnCountOf(session: PracticeSession): number {
  const mode = practiceModeOf(session);
  if (mode !== 'voice' && practicePhaseOf(session) === 'writing') return session.turn_count;
  if (session.written_turn_count !== undefined) return session.written_turn_count;
  return mode === 'voice' ? 0 : session.turn_count;
}

export function spokenTurnCountOf(session: PracticeSession): number {
  if (session.spoken_turn_count !== undefined) return session.spoken_turn_count;
  const mode = practiceModeOf(session);
  return mode === 'text_chat' || mode === 'write_then_speak' ? 0 : session.turn_count;
}

export function sessionDetailsFrom(session: PracticeSession, nowMs: number): SessionDetails {
  return {
    sessionId: session.session_id,
    question: session.opening_question,
    turnCount: session.turn_count,
    targetTurns: session.target_turns,
    retryEvidence: session.retry_evidence,
    topicId: session.topic_id,
    topicLabel: session.topic_label,
    topicCustom: session.topic_custom,
    durationGoalSeconds: session.duration_goal_seconds,
    activeDurationMs: session.active_duration_ms,
    startedAt: session.started_at,
    isClockRunning: session.is_clock_running,
    clockSnapshotAtMs: nowMs,
    practiceMode: practiceModeOf(session),
    practicePhase: practicePhaseOf(session),
    writtenTurnCount: writtenTurnCountOf(session),
    spokenTurnCount: spokenTurnCountOf(session),
    isMistakePractice: session.is_mistake_practice ?? false,
  };
}
