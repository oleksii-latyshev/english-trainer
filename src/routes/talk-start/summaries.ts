import type { DueMemory } from '@/core/learning-memory';
import type { SessionDetails } from '@/features/practice/lib/practiceState';
import type { MistakePracticeSummary, ReviewSummary } from '@/screens/talk-start';

type PracticeActivity = {
  readonly isSessionOpen: boolean;
  readonly isAudioBusy: boolean;
  readonly isStarting: boolean;
};

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

function blockedReason(activity: PracticeActivity): string | null {
  if (activity.isSessionOpen) return 'Continue or finish the current conversation first.';
  if (activity.isAudioBusy) return 'Wait for the microphone to become available.';
  return null;
}

export function mistakePracticeSummary(
  due: DueMemory,
  activity: PracticeActivity,
): MistakePracticeSummary | undefined {
  if (due.tag !== 'ready') return undefined;
  return {
    mistakes: due.usualMistakes.map((mistake) => ({
      id: mistake.id,
      original: mistake.original_example,
      corrected: mistake.corrected_example,
    })),
    blockedReason: blockedReason(activity),
    isStarting: activity.isStarting,
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
