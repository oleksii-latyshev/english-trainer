import type { ExerciseView } from '@/core/mistakes';

type GapSentence = NonNullable<ExerciseView['sentence']>;

export type SentencePart =
  | { readonly kind: 'word'; readonly text: string }
  | { readonly kind: 'gap'; readonly index: number; readonly wordCount: number };

export function sentenceParts(sentence: GapSentence): readonly SentencePart[] {
  const parts: SentencePart[] = [];
  let index = 0;
  while (index < sentence.words.length) {
    const gapIndex = sentence.gaps.findIndex((gap) => gap.start === index);
    const gap = sentence.gaps[gapIndex];
    if (gap === undefined) {
      parts.push({ kind: 'word', text: sentence.words[index] ?? '…' });
      index += 1;
    } else {
      parts.push({ kind: 'gap', index: gapIndex, wordCount: Math.max(gap.end - gap.start, 1) });
      index = Math.max(gap.end, index + 1);
    }
  }
  return parts;
}

export function keptGapWords(sentence: GapSentence, keep: string): readonly string[] {
  const words = keep.split(/\s+/).filter((word) => word !== '');
  return sentence.gaps.map((gap) => words.slice(gap.start, gap.end).join(' '));
}
