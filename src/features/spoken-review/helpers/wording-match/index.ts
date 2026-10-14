export type WordingSegment = { readonly text: string; readonly isMatch: boolean };

type Word = { readonly word: string; readonly start: number; readonly end: number };

const MAX_WORDS_BETWEEN_PARTS = 8;

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

function partsFollow(
  spoken: readonly Word[],
  parts: readonly string[][],
  index: number,
  from: number,
): number[] | null {
  const part = parts[index];
  if (!part) return [];
  const lastStart =
    index === 0 ? spoken.length : Math.min(from + MAX_WORDS_BETWEEN_PARTS, spoken.length);
  for (let at = from; at <= lastStart; at += 1) {
    if (!startsWithAt(spoken, at, part)) continue;
    const rest = partsFollow(spoken, parts, index + 1, at + part.length);
    if (rest) return [at, ...rest];
  }
  return null;
}

function matchedRanges(parts: readonly string[][], spoken: readonly Word[]) {
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
  return ranges;
}

export function highlightWording(target: string, transcript: string): WordingSegment[] {
  const ranges = matchedRanges(phraseParts(target), wordsOf(transcript));
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

export function hasWording(segments: readonly WordingSegment[]): boolean {
  return segments.some((segment) => segment.isMatch);
}
