import type { MistakeGroup, MistakeGroups } from '@/core/mistakes';

export const SHOWN_MISTAKES = 3;

export const NOT_SORTED_TITLE = 'Not sorted yet';

export const NOT_SORTED_HINT = 'Eva is still preparing these lessons.';

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function dayLabel(timestampMs: number): string {
  return dayFormat.format(new Date(timestampMs));
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function totalMistakes(groups: MistakeGroups): number {
  return (
    groups.groups.reduce((sum, group) => sum + group.mistake_count, 0) + groups.ungrouped.length
  );
}

export function fixedMistakes(groups: MistakeGroups): number {
  return (
    groups.groups.reduce((sum, group) => sum + group.fixed_count, 0) +
    groups.ungrouped.filter((mistake) => mistake.is_fixed).length
  );
}

export function overviewLine(groups: MistakeGroups): string {
  const parts = [
    `${plural(totalMistakes(groups), 'mistake', 'mistakes')} in ${plural(groups.groups.length, 'rule', 'rules')}`,
    `${groups.due_count} ready to practise`,
    `${fixedMistakes(groups)} fixed`,
  ];
  return parts.join(' · ');
}

export function relapseLabel(group: MistakeGroup): string | null {
  if (group.relapse_count === 0 || group.last_relapse_at === null) return null;
  return `Came back on ${dayLabel(group.last_relapse_at)}`;
}

export function fixedLabel(group: MistakeGroup): string | null {
  return group.fixed_count > 0 ? `${group.fixed_count} fixed` : null;
}

export function moreLabel(group: MistakeGroup): string | null {
  const rest = group.mistake_count - Math.min(group.mistakes.length, SHOWN_MISTAKES);
  return rest > 0 ? `and ${rest} more` : null;
}

export function practiseLabel(dueCount: number): string {
  return `Practise ${dueCount} · 5 min`;
}
