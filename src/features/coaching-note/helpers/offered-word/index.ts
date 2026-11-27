import type { DebriefWord } from '../../types';

function key(phrase: string): string {
  return phrase.trim().toLowerCase();
}

export function offeredWord(
  offered: readonly DebriefWord[],
  phrase: string,
): DebriefWord | undefined {
  return offered.find((word) => key(word.phrase) === key(phrase));
}
