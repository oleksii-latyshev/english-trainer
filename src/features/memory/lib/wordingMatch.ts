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

/** Same limit as Rust's `MAX_GAP_WORDS` in conversation/recall.rs. */
const MAX_GAP_WORDS = 8;

/** The saved phrase as whole-word pieces between its "…" gaps ("..." counts as one too). */
function phraseParts(target: string): string[][] {
  return target
    .split(/…|\.\.\./)
    .map((part) => wordsOf(part).map((entry) => entry.word))
    .filter((part) => part.length > 0);
}

function startsWithAt(spoken: readonly Word[], at: number, part: readonly string[]): boolean {
  return (
    at + part.length <= spoken.length &&
    part.every((word, offset) => spoken[at + offset].word === word)
  );
}

/** Start index of each part when `parts[index..]` follow from `from`, as Rust's `parts_follow`. */
function partsFollow(
  spoken: readonly Word[],
  parts: readonly string[][],
  index: number,
  from: number,
): number[] | null {
  const part = parts[index];
  if (!part) return [];
  const lastStart = index === 0 ? spoken.length : Math.min(from + MAX_GAP_WORDS, spoken.length);
  for (let at = from; at <= lastStart; at += 1) {
    if (!startsWithAt(spoken, at, part)) continue;
    const rest = partsFollow(spoken, parts, index + 1, at + part.length);
    if (rest) return [at, ...rest];
  }
  return null;
}

/**
 * Splits a transcript around where the target wording was said, for display only. The match is
 * the one Rust's `wording_observed` accepts (whole words; "…" pieces in order with a short gap),
 * and Rust alone decides whether the answer counts: nothing is marked when the wording is absent.
 */
export function highlightWording(target: string, transcript: string): WordingSegment[] {
  const parts = phraseParts(target);
  const spoken = wordsOf(transcript);
  const ranges: { start: number; end: number }[] = [];
  let from = 0;
  while (parts.length > 0) {
    const starts = partsFollow(spoken, parts, 0, from);
    if (!starts) break;
    starts.forEach((at, index) => {
      ranges.push({ start: spoken[at].start, end: spoken[at + parts[index].length - 1].end });
    });
    const lastIndex = starts.length - 1;
    from = starts[lastIndex] + parts[lastIndex].length;
  }
  const segments: WordingSegment[] = [];
  let cursor = 0;
  for (const { start, end } of ranges) {
    if (start > cursor) segments.push({ text: transcript.slice(cursor, start), isMatch: false });
    segments.push({ text: transcript.slice(start, end), isMatch: true });
    cursor = end;
  }
  if (cursor < transcript.length) segments.push({ text: transcript.slice(cursor), isMatch: false });
  return segments;
}

/** Whether the highlight found the wording; never a substitute for the saved result. */
export function hasWording(segments: readonly WordingSegment[]): boolean {
  return segments.some((segment) => segment.isMatch);
}
