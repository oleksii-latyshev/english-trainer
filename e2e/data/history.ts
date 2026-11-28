import type { PhraseCardRecord } from '@/core/ipc';
import type { FinishedSessionItem } from '@/core/ipc/bindings/FinishedSessionItem';

const HOUR_MS = 60 * 60 * 1000;

function endedHoursAgo(hours: number): number {
  return Date.now() - hours * HOUR_MS;
}

export const workConversation: FinishedSessionItem = {
  session_id: 41,
  ended_at: endedHoursAgo(1),
  title: 'Work & technology',
  answer_count: 3,
  focus_rule_title: 'Word order in questions',
};

export const travelConversation: FinishedSessionItem = {
  session_id: 40,
  ended_at: endedHoursAgo(30),
  title: 'What is your favourite place to travel to?',
  answer_count: 1,
  focus_rule_title: null,
};

export function olderConversations(count: number): FinishedSessionItem[] {
  return Array.from({ length: count }, (_, index) => ({
    session_id: 30 - index,
    ended_at: endedHoursAgo(100 + index),
    title: `Older talk ${index + 1}`,
    answer_count: 2,
    focus_rule_title: null,
  }));
}

export const takenBefore: PhraseCardRecord = {
  id: 77,
  phrase: 'for two years',
  kind: 'phrase',
  normalized_phrase: 'for two years',
  meaning_or_note: 'during the last two years',
  session_id: 41,
  sequence: 1,
  created_at: endedHoursAgo(1),
  last_reviewed_at: null,
  next_review_at: endedHoursAgo(1),
  interval_days: 1,
  ease_factor: 2.5,
  status: 'new',
  is_due: false,
  times_used_on_own: 0,
};
