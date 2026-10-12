import { expect, it } from 'bun:test';
import { addTerm, canAddTerm, hiddenTermCount, removeTerm, VISIBLE_TERMS, visibleTerms } from '.';

const MANY = Array.from({ length: VISIBLE_TERMS + 4 }, (_, index) => `term${index}`);

it('appends and removes a term without touching the others', () => {
  expect(addTerm(['a'], 'b')).toEqual(['a', 'b']);
  expect(removeTerm(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
});

it('accepts only a term with visible characters', () => {
  expect(canAddTerm('Tauri')).toBe(true);
  expect(canAddTerm('   ')).toBe(false);
});

it('shows the first terms and counts the rest until everything is requested', () => {
  expect(visibleTerms(MANY, false)).toHaveLength(VISIBLE_TERMS);
  expect(hiddenTermCount(MANY, false)).toBe(4);
  expect(visibleTerms(MANY, true)).toEqual(MANY);
  expect(hiddenTermCount(MANY, true)).toBe(0);
  expect(hiddenTermCount(['a'], false)).toBe(0);
});
