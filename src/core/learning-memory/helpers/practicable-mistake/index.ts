import type { MistakeRecord } from '@/core/ipc';

type MistakeText = Pick<
  MistakeRecord,
  'status' | 'times_seen' | 'original_example' | 'corrected_example' | 'explanation'
>;

const MIN_TIMES_SEEN = 2;
const MAX_EXAMPLE_CHARS = 300;
const MAX_EXPLANATION_CHARS = 500;

function hasBoundedText(value: string, maxLength: number): boolean {
  return value.trim().length > 0 && Array.from(value).length <= maxLength;
}

export function isPracticableMistake(mistake: MistakeText): boolean {
  return (
    mistake.status !== 'archived' &&
    mistake.times_seen >= MIN_TIMES_SEEN &&
    hasBoundedText(mistake.original_example, MAX_EXAMPLE_CHARS) &&
    hasBoundedText(mistake.corrected_example, MAX_EXAMPLE_CHARS) &&
    hasBoundedText(mistake.explanation, MAX_EXPLANATION_CHARS)
  );
}

export function practicableMistakeCount(mistakes: readonly MistakeRecord[]): number {
  return mistakes.filter(isPracticableMistake).length;
}
