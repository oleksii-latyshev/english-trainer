import { describe, expect, it } from 'bun:test';
import { aPhrase } from '../../tests/builders';
import {
  isEverythingSaved,
  keptPhrases,
  markSaved,
  NO_SELECTION,
  phrasesToSave,
  removePhrase,
  unmarkSaved,
} from './index';

const PHRASES = [
  aPhrase({ phrase: 'It saves me time.' }),
  aPhrase({ phrase: 'I tend to plan ahead.' }),
  aPhrase({ phrase: 'That gives me more room to focus.' }),
];

describe('phrase selection', () => {
  it('leaves out the phrases the learner removed', () => {
    const selection = removePhrase(NO_SELECTION, 'I tend to plan ahead.');
    expect(keptPhrases(PHRASES, selection).map((item) => item.phrase)).toEqual([
      'It saves me time.',
      'That gives me more room to focus.',
    ]);
  });

  it('offers only the kept phrases that are not saved yet', () => {
    const selection = markSaved(removePhrase(NO_SELECTION, 'I tend to plan ahead.'), [
      'It saves me time.',
    ]);
    expect(phrasesToSave(PHRASES, selection)).toEqual(['That gives me more room to focus.']);
    expect(isEverythingSaved(PHRASES, selection)).toBe(false);
  });

  it('knows when everything kept is saved, and takes it back on undo', () => {
    const removed = removePhrase(NO_SELECTION, 'I tend to plan ahead.');
    const saved = markSaved(removed, ['It saves me time.', 'That gives me more room to focus.']);
    expect(isEverythingSaved(PHRASES, saved)).toBe(true);
    const undone = unmarkSaved(saved, ['It saves me time.']);
    expect(isEverythingSaved(PHRASES, undone)).toBe(false);
    expect(phrasesToSave(PHRASES, undone)).toEqual(['It saves me time.']);
  });

  it('is not saved when there is nothing to save', () => {
    expect(isEverythingSaved([], NO_SELECTION)).toBe(false);
  });
});
