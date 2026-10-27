import type { OpenSession } from '../../types';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function utcDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function startedWhen(startedAt: number, now: number): string {
  const daysAgo = Math.floor((utcDay(now) - utcDay(startedAt)) / DAY_MS);
  if (daysAgo === 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  return new Date(startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeDetail(session: OpenSession): string {
  if (session.durationGoalSeconds === null) {
    return `${Math.floor(session.activeDurationMs / MINUTE_MS)} min so far`;
  }
  const left = Math.max(
    0,
    Math.ceil((session.durationGoalSeconds * 1000 - session.activeDurationMs) / MINUTE_MS),
  );
  return `${left} min left`;
}

export function resumeDetail(session: OpenSession, now: number = Date.now()): string {
  if (session.isMistakePractice && session.targetTurns !== undefined) {
    const remaining = Math.max(0, session.targetTurns - (session.turnCount ?? 0));
    return `${remaining} ${remaining === 1 ? 'question' : 'questions'} left`;
  }
  return `${session.topicLabel} · Started ${startedWhen(session.startedAt, now)} · ${timeDetail(session)}`;
}
