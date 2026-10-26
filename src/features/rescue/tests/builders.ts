import type { Listening } from '@/core/answer-capture';
import type { SessionDetails } from '@/core/practice-session';

export function aSessionDetails(overrides: Partial<SessionDetails> = {}): SessionDetails {
  return {
    sessionId: 7,
    question: 'How was your day?',
    turnCount: 0,
    targetTurns: 8,
    retryEvidence: [],
    topicId: 'daily_life',
    topicLabel: 'Daily life',
    topicCustom: null,
    durationGoalSeconds: 600,
    activeDurationMs: 0,
    startedAt: 1,
    isClockRunning: false,
    clockSnapshotAtMs: 0,
    practiceMode: 'voice',
    practicePhase: 'speaking',
    writtenTurnCount: 0,
    spokenTurnCount: 0,
    isMistakePractice: false,
    ...overrides,
  };
}

export function aListening(): Listening {
  return {
    elapsedMs: 1000,
    level: 0.2,
    mode: 'manual',
    held: false,
    heardSpeech: true,
    liveText: '',
  };
}
