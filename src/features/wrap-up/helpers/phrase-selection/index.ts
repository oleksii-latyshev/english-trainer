import type { PhraseSelection, WrapupPhrase } from '../../types';

export const NO_SELECTION: PhraseSelection = { removed: new Set(), saved: new Set() };

export function removePhrase(selection: PhraseSelection, phrase: string): PhraseSelection {
  return { ...selection, removed: new Set([...selection.removed, phrase]) };
}

export function markSaved(selection: PhraseSelection, phrases: readonly string[]): PhraseSelection {
  return { ...selection, saved: new Set([...selection.saved, ...phrases]) };
}

export function unmarkSaved(
  selection: PhraseSelection,
  phrases: readonly string[],
): PhraseSelection {
  return { ...selection, saved: new Set([...selection.saved].filter((p) => !phrases.includes(p))) };
}

export function keptPhrases(
  phrases: readonly WrapupPhrase[],
  selection: PhraseSelection,
): readonly WrapupPhrase[] {
  return phrases.filter((item) => !selection.removed.has(item.phrase));
}

export function phrasesToSave(
  phrases: readonly WrapupPhrase[],
  selection: PhraseSelection,
): readonly string[] {
  return keptPhrases(phrases, selection)
    .map((item) => item.phrase)
    .filter((phrase) => !selection.saved.has(phrase));
}

export function isEverythingSaved(
  phrases: readonly WrapupPhrase[],
  selection: PhraseSelection,
): boolean {
  return (
    keptPhrases(phrases, selection).length > 0 && phrasesToSave(phrases, selection).length === 0
  );
}
