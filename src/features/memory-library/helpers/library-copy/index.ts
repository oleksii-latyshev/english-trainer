import type { FocusCategory, LearningStatus, MistakeRecord, PhraseCardRecord } from '@/core/ipc';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(timestampMs: number): number {
  const day = new Date(timestampMs);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
}

function calendarDaysBetween(fromMs: number, toMs: number): number {
  return Math.round((startOfDay(toMs) - startOfDay(fromMs)) / MS_PER_DAY);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function statusLabel(status: LearningStatus): string {
  return capitalise(status);
}

export function categoryLabel(category: FocusCategory): string {
  return capitalise(category);
}

export function whenLabel(timestampMs: number, now: number): string {
  const days = calendarDaysBetween(timestampMs, now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'last week';
  if (days < 60) return `${weeks} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function nextReviewLabel(nextReviewAt: number, status: LearningStatus, now: number): string {
  if (status === 'archived') return 'Archived';
  const days = calendarDaysBetween(now, nextReviewAt);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function isDueToday(nextReviewAt: number, status: LearningStatus, now: number): boolean {
  return status !== 'archived' && calendarDaysBetween(now, nextReviewAt) <= 0;
}

export function gapLabel(intervalDays: number): string {
  return intervalDays === 1 ? '1 day' : `${intervalDays} days`;
}

export function phraseSourceLine(card: PhraseCardRecord, now: number): string {
  const note = card.meaning_or_note.trim();
  const when = capitalise(whenLabel(card.created_at, now));
  const topic = card.session_topic?.trim();
  if (topic) return `${topic}${note ? ` · ${note}` : ''} · ${when}`;
  const origin = note || (card.session_id === null ? 'Saved by hand' : 'From a conversation');
  return `${origin} · ${when}`;
}

export function mistakeSourceLine(mistake: MistakeRecord): string {
  return `${categoryLabel(mistake.category)} · seen ${mistake.times_seen}×`;
}
