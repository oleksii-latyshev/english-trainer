import type { ConversationItem } from '../../types';

const DAY_MS = 86_400_000;

function localDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function whenLabel(endedAt: number, now: number): string {
  const daysAgo = Math.round((localDay(now) - localDay(endedAt)) / DAY_MS);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return new Date(endedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function answersLabel(count: number): string {
  return count === 1 ? '1 answer' : `${count} answers`;
}

export function conversationDetail(item: ConversationItem, now: number = Date.now()): string {
  const parts = [whenLabel(item.ended_at, now), answersLabel(item.answer_count)];
  if (item.focus_rule_title !== null) parts.push(item.focus_rule_title);
  return parts.join(' · ');
}
