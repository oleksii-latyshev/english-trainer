import { expect, it } from 'bun:test';
import type { ExerciseView } from '@/core/mistakes';
import { keptGapWords, sentenceParts } from './index';

type GapSentence = NonNullable<ExerciseView['sentence']>;

const SENTENCE: GapSentence = {
  words: ['I', null, null, 'there', 'since', 'May'],
  gaps: [{ start: 1, end: 3 }],
};

it('turns the hidden words into one gap sized by its words', () => {
  expect(sentenceParts(SENTENCE)).toEqual([
    { kind: 'word', text: 'I' },
    { kind: 'gap', index: 0, wordCount: 2 },
    { kind: 'word', text: 'there' },
    { kind: 'word', text: 'since' },
    { kind: 'word', text: 'May' },
  ]);
});

it('numbers several gaps in reading order', () => {
  const parts = sentenceParts({
    words: [null, 'went', null],
    gaps: [
      { start: 0, end: 1 },
      { start: 2, end: 3 },
    ],
  });
  expect(parts.filter((part) => part.kind === 'gap')).toEqual([
    { kind: 'gap', index: 0, wordCount: 1 },
    { kind: 'gap', index: 1, wordCount: 1 },
  ]);
});

it('reads the kept words of each gap from the version to keep', () => {
  expect(keptGapWords(SENTENCE, 'I have been there since May')).toEqual(['have been']);
});
