import type { MistakeRecord } from '@/lib/learningTypes';

type MistakePracticeFields = Pick<
  MistakeRecord,
  'status' | 'times_seen' | 'original_example' | 'corrected_example' | 'explanation'
>;

function hasBoundedText(value: string, maxLength: number): boolean {
  return value.trim().length > 0 && Array.from(value).length <= maxLength;
}

export function isEligibleMistakePracticeTarget(mistake: MistakePracticeFields): boolean {
  return (
    mistake.status !== 'archived' &&
    mistake.times_seen >= 2 &&
    hasBoundedText(mistake.original_example, 300) &&
    hasBoundedText(mistake.corrected_example, 300) &&
    hasBoundedText(mistake.explanation, 500)
  );
}

export function eligibleMistakePracticeCount(mistakes: MistakeRecord[]): number {
  return mistakes.filter(isEligibleMistakePracticeTarget).length;
}
