import type { PracticeMode, PracticePhase, SessionDetails } from '@/core/practice-session';

type ProgressBar = {
  value: number;
  max: number;
  percent: number;
};

export type SessionProgress = {
  label: string;
  bar: ProgressBar | null;
};

const MODE_LABEL: Record<PracticeMode, string> = {
  voice: 'Speak',
  text_chat: 'Text chat',
  write_then_speak: 'Write, then speak',
};

const PHASE_LABEL: Record<PracticePhase, string> = {
  writing: 'Writing',
  writing_review: 'Review writing',
  speaking: 'Speaking',
  speaking_review: 'Review speaking',
};

export function formatElapsedClock(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function elapsedSessionMs(
  activeDurationMs: number,
  snapshotAt: number,
  isClockRunning: boolean,
  now: number,
): number {
  return activeDurationMs + (isClockRunning ? Math.max(0, now - snapshotAt) : 0);
}

export function mistakePracticeProgress(turnCount: number, targetTurns: number) {
  const value = Math.min(turnCount + 1, targetTurns);
  const isComplete = turnCount >= targetTurns;
  const shown = isComplete ? targetTurns : value;
  return {
    label: isComplete
      ? 'Practice complete'
      : `Question ${value} of ${targetTurns} · About 2 minutes`,
    value: shown,
    percent: (shown / targetTurns) * 100,
    isComplete,
  };
}

function stageSuffix(session: SessionDetails): string {
  if (session.practiceMode !== 'write_then_speak') return '';
  const phase = PHASE_LABEL[session.practicePhase];
  if (session.practicePhase !== 'speaking') return ` · ${phase}`;
  const spoken = Math.min(session.spokenTurnCount, session.writtenTurnCount);
  return ` · ${phase} · ${spoken} of ${session.writtenTurnCount}`;
}

export function sessionProgress(session: SessionDetails, elapsedMs: number): SessionProgress {
  if (session.isMistakePractice) {
    const drill = mistakePracticeProgress(session.turnCount, session.targetTurns);
    return {
      label: drill.label,
      bar: { value: drill.value, max: session.targetTurns, percent: drill.percent },
    };
  }
  const elapsed = formatElapsedClock(elapsedMs);
  const mode = `${MODE_LABEL[session.practiceMode]}${stageSuffix(session)}`;
  if (session.durationGoalSeconds === null) return { label: `${elapsed} · ${mode}`, bar: null };
  const goalMs = session.durationGoalSeconds * 1000;
  const goal = formatElapsedClock(goalMs);
  return {
    label: `${elapsed} of ${goal} · ${mode}`,
    bar: {
      value: Math.min(Math.floor(elapsedMs / 1000), session.durationGoalSeconds),
      max: session.durationGoalSeconds,
      percent: Math.min(100, (elapsedMs / goalMs) * 100),
    },
  };
}
