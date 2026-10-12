export const VISIBLE_TERMS = 8;

export function addTerm(terms: readonly string[], term: string): readonly string[] {
  return [...terms, term];
}

export function removeTerm(terms: readonly string[], term: string): readonly string[] {
  return terms.filter((other) => other !== term);
}

export function canAddTerm(term: string): boolean {
  return term.trim() !== '';
}

export function visibleTerms(terms: readonly string[], showAll: boolean): readonly string[] {
  return showAll ? terms : terms.slice(0, VISIBLE_TERMS);
}

export function hiddenTermCount(terms: readonly string[], showAll: boolean): number {
  return showAll ? 0 : Math.max(0, terms.length - VISIBLE_TERMS);
}
