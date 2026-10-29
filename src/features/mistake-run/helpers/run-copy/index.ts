import type { ExerciseView, MistakeGroups, RuleKey, RunView } from '@/core/mistakes';
import { exercisePhase } from '../exercise-phase';

export type Tally = {
  readonly right: number;
  readonly missed: number;
  readonly checking: number;
  readonly open: number;
};

const INSTRUCTIONS = [
  'Type the missing words.',
  'Rewrite your sentence so it is correct.',
  'Hear the question, then say the version you want to keep.',
  'A new question. Answer aloud in your own words.',
] as const;

export function instruction(step: number): string {
  return INSTRUCTIONS[Math.min(Math.max(step, 1), INSTRUCTIONS.length) - 1];
}

export function askedLabel(step: number): string {
  return step === 4 ? 'A new question' : 'Eva asked';
}

export function progressLabel(position: number, total: number, ruleTitle: string | null): string {
  const base = `${position + 1} of ${total}`;
  return ruleTitle ? `${base} · ${ruleTitle}` : base;
}

export function ruleTitleOf(groups: MistakeGroups | null, rule: RuleKey | null): string | null {
  if (groups === null || rule === null) return null;
  return groups.groups.find((group) => group.rule_key === rule)?.title ?? null;
}

export function tally(run: RunView): Tally {
  const phases = run.items.map(exercisePhase);
  return {
    right: phases.filter((phase) => phase === 'passed').length,
    missed: phases.filter((phase) => phase === 'missed').length,
    checking: phases.filter((phase) => phase === 'checking' || phase === 'check-failed').length,
    open: phases.filter((phase) => phase === 'open').length,
  };
}

export function tallyLine(counts: Tally, total: number): string {
  const parts = [`${counts.right} of ${total} right`];
  if (counts.missed > 0) parts.push(`${counts.missed} to review`);
  if (counts.checking > 0) parts.push(`${counts.checking} still being checked`);
  return parts.join(' · ');
}

export function outcomeLabel(exercise: ExerciseView): string {
  switch (exercisePhase(exercise)) {
    case 'passed':
      return 'Right';
    case 'missed':
      return 'Not quite';
    case 'checking':
      return 'Checking…';
    case 'check-failed':
      return 'Not checked';
    case 'open':
      return 'Not practised';
  }
}
