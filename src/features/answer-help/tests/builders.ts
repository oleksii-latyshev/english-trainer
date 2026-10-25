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

export function anAnswerPlan(label = 'first') {
  return {
    frame: [`${label} step one`, `${label} step two`, `${label} step three`],
    phrases: [`${label} phrase one`, `${label} phrase two`, `${label} phrase three`],
    model_answer: `${label} model answer.`,
    adaptation: `${label} answer about [a topic].`,
  };
}
