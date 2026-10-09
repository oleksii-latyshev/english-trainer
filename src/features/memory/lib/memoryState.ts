import type {
  LearningMemoryView,
  LearningStatus,
  MistakeRecord,
  PhraseCardRecord,
} from '@/lib/learningTypes';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatDueText(nextReviewAt: number, now: number = Date.now()): string {
  const diffMs = nextReviewAt - now;
  if (diffMs <= 0) return 'Due for review';
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `Due in ${Math.max(1, diffHours)}h`;
  return `Due in ${Math.round(diffMs / MS_PER_DAY)}d`;
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

/**
 * How long ago, in calendar days, as a short phrase: "today", "yesterday", "3 days ago",
 * "last week", "3 weeks ago", "2 months ago". Future times read as "today".
 */
export function whenLabel(timestampMs: number, now: number = Date.now()): string {
  const startOfDay = (ms: number) => {
    const day = new Date(ms);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(timestampMs)) / MS_PER_DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'last week';
  if (days < 60) return `${weeks} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Where a saved phrase came from, then when: its note, or what kind of save it was. */
export function phraseSourceLine(card: PhraseCardRecord, now: number = Date.now()): string {
  const note = card.meaning_or_note.trim();
  if (card.session_topic?.trim()) {
    const detail = note ? ` · ${note}` : '';
    return `${card.session_topic.trim()}${detail} · ${capitalise(whenLabel(card.created_at, now))}`;
  }
  const origin = note || (card.session_id === null ? 'Saved by hand' : 'From a conversation');
  return `${origin} · ${capitalise(whenLabel(card.created_at, now))}`;
}

/** How often a mistake came up and when it last did. */
export function mistakeSourceLine(mistake: MistakeRecord, now: number = Date.now()): string {
  const times = mistake.times_seen === 1 ? '1 time' : `${mistake.times_seen} times`;
  return `${times} · last: ${whenLabel(mistake.last_seen_at, now)}`;
}

/** What Memory shows: archived items are hidden and never come back on their own. */
export type VisibleMemory = {
  phrases: PhraseCardRecord[];
  mistakes: MistakeRecord[];
};

export function visibleMemory(view: LearningMemoryView): VisibleMemory {
  return {
    phrases: view.phrase_cards.filter((card) => card.status !== 'archived'),
    mistakes: view.mistakes.filter((mistake) => mistake.status !== 'archived'),
  };
}

function matches(query: string, ...fields: string[]): boolean {
  return fields.some((field) => field.toLowerCase().includes(query));
}

/** Search matches the wording and where it came from; an empty query keeps everything. */
export function searchMemory(memory: VisibleMemory, rawQuery: string): VisibleMemory {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return memory;
  return {
    phrases: memory.phrases.filter((card) =>
      matches(query, card.phrase, card.meaning_or_note, card.session_topic ?? ''),
    ),
    mistakes: memory.mistakes.filter((mistake) =>
      matches(
        query,
        mistake.original_example,
        mistake.corrected_example,
        mistake.explanation,
        mistake.category,
      ),
    ),
  };
}
