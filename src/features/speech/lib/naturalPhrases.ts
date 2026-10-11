const MAX_PHRASE_CHARS = 48;
const MIN_CLAUSE_CHARS = 24;

/** Bound neural work per chunk; punctuation/conjunctions retain more natural phrasing. */
export function splitNaturalPhrases(text: string): string[] {
  const phrases: string[] = [];
  let remaining = text.trim();
  while (remaining.length > MAX_PHRASE_CHARS) {
    const prefix = remaining.slice(0, MAX_PHRASE_CHARS + 1);
    const candidates = [...prefix.matchAll(/[,;:]\s+|\s+(?=(?:and|but|because|so|which|when)\s)/g)]
      .map((match) => match.index + (/[,;:]/.test(match[0][0] ?? '') ? 1 : 0))
      .filter((index) => index >= MIN_CLAUSE_CHARS && index <= MAX_PHRASE_CHARS);
    let cut = candidates[candidates.length - 1] ?? prefix.lastIndexOf(' ');
    // An oversized single token stays intact instead of becoming two mispronounced words.
    if (cut <= 0) cut = remaining.indexOf(' ');
    if (cut <= 0) break;
    phrases.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) phrases.push(remaining);
  return phrases;
}
