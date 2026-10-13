import type { WarmupPhrase } from '../../types';

export function dueLabel(dueCount: number): string {
  return `${dueCount} due`;
}

export function phraseSource(phrase: WarmupPhrase): string {
  return [phrase.topic ? `From ${phrase.topic}` : undefined, phrase.note]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
}

export function emptyHint(): string {
  return 'Phrases you save while talking will come back here.';
}
