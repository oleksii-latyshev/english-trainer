import { expect, test } from 'bun:test';
import { splitNaturalPhrases } from './naturalPhrases';

test('long replies prefer a clause break and retain every word exactly once', () => {
  const text = 'That sounds like a useful approach, and it could save you a lot of time at work.';
  const phrases = splitNaturalPhrases(text);
  expect(phrases[0]).toBe('That sounds like a useful approach,');
  expect(phrases.join(' ')).toBe(text);
  expect(phrases.every((phrase) => phrase.length <= 48)).toBe(true);
});
test('long uninterrupted sentences are bounded at whole words without changing numbers or quotes', () => {
  const text =
    'I usually start by breaking the problem down into smaller steps so I can make steady progress with "version 3.14".';
  const phrases = splitNaturalPhrases(text);
  expect(phrases.join(' ')).toBe(text);
  expect(phrases.every((phrase) => phrase.length <= 48)).toBe(true);
  expect(splitNaturalPhrases('Hi!')).toEqual(['Hi!']);
  expect(splitNaturalPhrases(' ')).toEqual([]);
  const token = 'a'.repeat(80);
  expect(splitNaturalPhrases(token)).toEqual([token]);
});
