import type { PracticeSession, SessionDetails } from '../../types';

function writtenTurnCountOf(session: PracticeSession): number {
  const isWritingText = session.practice_mode !== 'voice' && session.practice_phase === 'writing';
  return isWritingText ? session.turn_count : session.written_turn_count;
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
    practiceMode: session.practice_mode,
    practicePhase: session.practice_phase,
    writtenTurnCount: writtenTurnCountOf(session),
    spokenTurnCount: session.spoken_turn_count,
    isMistakePractice: session.is_mistake_practice,
  };
}
