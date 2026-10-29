import type { DueMemory } from '@/core/learning-memory';
import type { SessionDetails } from '@/core/practice-session';
import type { ReviewSummary } from '@/screens/talk-start';

export function reviewSummary(due: DueMemory): ReviewSummary | undefined {
  if (due.tag !== 'ready') return undefined;
  const card = due.nextDuePhrase;
  return {
    dueCount: due.dueCount,
    nextPhrase: card && {
      phrase: card.phrase,
      topic: card.session_topic ?? undefined,
      note: card.meaning_or_note,
    },
  };
}

export function openSessionOf(session: SessionDetails | undefined) {
  if (!session) return undefined;
  return {
    topicLabel: session.topicLabel,
    startedAt: session.startedAt,
    durationGoalSeconds: session.durationGoalSeconds,
    activeDurationMs: session.activeDurationMs,
    isMistakePractice: session.isMistakePractice,
    turnCount: session.turnCount,
    targetTurns: session.targetTurns,
  };
}
