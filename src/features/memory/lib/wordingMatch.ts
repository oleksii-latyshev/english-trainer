export type WordingSegment = { text: string; isMatch: boolean };

type Word = { word: string; start: number; end: number };

/**
 * Words the way Rust's `normalize_phrase` reads them: letters, digits and inner apostrophes,
 * lower-cased. Keeps each word's place in the original text so the match can be marked there.
 */
function wordsOf(text: string): Word[] {
  const words: Word[] = [];
  for (const token of text.matchAll(/[\p{L}\p{N}']+/gu)) {
    const raw = token[0];
    const leading = raw.length - raw.replace(/^'+/, '').length;
    const word = raw.replace(/^'+|'+$/g, '').toLowerCase();
    if (!word) continue;
    const start = token.index + leading;
    words.push({ word, start, end: start + word.length });
  }
  return words;
}

/**
 * Splits a transcript around where the target wording was said, for display only. The match is
 * the same whole-word sequence Rust's `wording_observed` accepts, and Rust alone decides whether
 * the answer counts: no segment is marked when the wording is not there.
 */
export function highlightWording(target: string, transcript: string): WordingSegment[] {
  const targetWords = wordsOf(target).map((entry) => entry.word);
  const spoken = wordsOf(transcript);
  const segments: WordingSegment[] = [];
  let cursor = 0;
  let index = 0;
  while (targetWords.length > 0 && index + targetWords.length <= spoken.length) {
    const isMatch = targetWords.every((word, offset) => spoken[index + offset].word === word);
    if (!isMatch) {
      index += 1;
      continue;
    }
    const start = spoken[index].start;
    const end = spoken[index + targetWords.length - 1].end;
    if (start > cursor) segments.push({ text: transcript.slice(cursor, start), isMatch: false });
    segments.push({ text: transcript.slice(start, end), isMatch: true });
    cursor = end;
    index += targetWords.length;
  }
  if (cursor < transcript.length) segments.push({ text: transcript.slice(cursor), isMatch: false });
  return segments;
}

/** Whether the highlight found the wording; never a substitute for the saved result. */
export function hasWording(segments: readonly WordingSegment[]): boolean {
  return segments.some((segment) => segment.isMatch);
}
