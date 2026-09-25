import type {
  LearningMemoryView,
  LearningStatus,
  MistakeRecord,
  PhraseCardRecord,
  ReviewResult,
} from '@/lib/learningTypes';

export type MemoryFilter = 'all' | 'due' | 'mistakes' | 'phrases';

export function formatDueText(nextReviewAt: number, now: number = Date.now()): string {
  const diffMs = nextReviewAt - now;
  if (diffMs <= 0) {
    return 'Due for review';
  }
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return `Due in ${Math.max(1, diffHours)}h`;
  }
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return `Due in ${diffDays}d`;
}

export function formatStatusLabel(status: LearningStatus): string {
  switch (status) {
    case 'new':
      return 'New';
    case 'learning':
      return 'Learning';
    case 'improving':
      return 'Improving';
    case 'stable':
      return 'Stable';
    case 'archived':
      return 'Archived';
  }
}

export function filterMemoryItems(
  view: LearningMemoryView,
  filter: MemoryFilter,
): { mistakes: MistakeRecord[]; phraseCards: PhraseCardRecord[] } {
  switch (filter) {
    case 'due':
      return {
        mistakes: view.mistakes.filter((item) => item.is_due),
        phraseCards: view.phrase_cards.filter((item) => item.is_due),
      };
    case 'mistakes':
      return {
        mistakes: view.mistakes,
        phraseCards: [],
      };
    case 'phrases':
      return {
        mistakes: [],
        phraseCards: view.phrase_cards,
      };
    default:
      return {
        mistakes: view.mistakes,
        phraseCards: view.phrase_cards,
      };
  }
}

export function applyReviewResult(
  view: LearningMemoryView,
  result: ReviewResult,
  now: number = Date.now(),
): LearningMemoryView {
  if (result.item_type === 'mistake') {
    const updatedMistakes = view.mistakes.map((item) => {
      if (item.id === result.item_id) {
        const is_due = result.status !== 'archived' && result.next_review_at <= now;
        return {
          ...item,
          status: result.status,
          next_review_at: result.next_review_at,
          interval_days: result.interval_days,
          last_reviewed_at: now,
          is_due,
        };
      }
      return item;
    });
    const due_count =
      updatedMistakes.filter((m) => m.is_due).length +
      view.phrase_cards.filter((p) => p.is_due).length;
    return {
      ...view,
      mistakes: updatedMistakes,
      due_count,
    };
  }

  const updatedPhrases = view.phrase_cards.map((item) => {
    if (item.id === result.item_id) {
      const is_due = result.status !== 'archived' && result.next_review_at <= now;
      return {
        ...item,
        status: result.status,
        next_review_at: result.next_review_at,
        interval_days: result.interval_days,
        last_reviewed_at: now,
        is_due,
      };
    }
    return item;
  });

  const due_count =
    view.mistakes.filter((m) => m.is_due).length + updatedPhrases.filter((p) => p.is_due).length;

  return {
    ...view,
    phrase_cards: updatedPhrases,
    due_count,
  };
}
