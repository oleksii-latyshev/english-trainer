import type { FinishedSession, PracticeSession, SessionDetails } from '../types';

export function aSessionDetails(overrides: Partial<SessionDetails> = {}): SessionDetails {
  return {
    sessionId: 7,
    question: 'How was your day?',
    turnCount: 1,
    targetTurns: 8,
    retryEvidence: [],
    topicId: 'daily_life',
    topicLabel: 'Daily life',
    topicCustom: null,
    durationGoalSeconds: 600,
    activeDurationMs: 42000,
    startedAt: 1780000000000,
    isClockRunning: true,
    clockSnapshotAtMs: 2000,
    practiceMode: 'voice',
    practicePhase: 'speaking',
    writtenTurnCount: 0,
    spokenTurnCount: 1,
    isMistakePractice: false,
    ...overrides,
  };
}

export function aPracticeSession(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    session_id: 7,
    opening_question: 'How was your day?',
    turn_count: 0,
    target_turns: 8,
    retry_evidence: [],
    topic_id: 'daily_life',
    topic_label: 'Daily life',
    topic_custom: null,
    duration_goal_seconds: 600,
    active_duration_ms: 0,
    started_at: 1780000000000,
    is_clock_running: false,
    practice_mode: 'voice',
    practice_phase: 'speaking',
    written_turn_count: 0,
    spoken_turn_count: 0,
    is_mistake_practice: false,
    ...overrides,
  };
}

export function aFinishedSession(overrides: Partial<FinishedSession> = {}): FinishedSession {
  return {
    session_id: 7,
    finished: true,
    turn_count: 3,
    target_turns: 8,
    duration_ms: 90000,
    topic_label: 'Daily life',
    duration_goal_seconds: 600,
    numbers: {
      speaking_time: { duration_ms: null, trend: { kind: 'first' } },
      words_per_minute: { value: null, trend: { kind: 'first' } },
      average_answer: { words: null, trend: { kind: 'first' } },
    },
    phrases: [],
    recurring_mistakes: [],
    pending_coaching: 0,
    is_coaching_paused: false,
    wrapup_preparation: { state: 'ready' },
    practice_mode: 'voice',
    practice_phase: 'speaking',
    written_turn_count: 0,
    spoken_turn_count: 3,
    is_mistake_practice: false,
    ...overrides,
  };
}
