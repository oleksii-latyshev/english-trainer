import type { DebriefWin } from '../../types';

export function winLine(phrase: string): string {
  return `✓ Used on your own: ${phrase}`;
}

export function wonPhrases(wins: readonly Pick<DebriefWin, 'phrase'>[]): readonly string[] {
  const seen = new Set<string>();
  return wins
    .map((win) => win.phrase)
    .filter((phrase) => {
      const key = phrase.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
