import { describe, expect, test } from 'bun:test';
import { INITIAL_SYNTHESIS_ESTIMATE } from '../speech-timing';
import { cutPhrase, FIRST_PHRASE_BUDGET, laterPhraseBudget, type PhraseBudget } from './index';

function phrasesOf(sentences: readonly string[], budget: PhraseBudget): string[] {
  const phrases: string[] = [];
  let pending = sentences;
  for (let guard = 0; guard < 50; guard += 1) {
    const cut = cutPhrase(pending, budget);
    if (!cut) break;
    phrases.push(cut.phrase);
    pending = cut.rest;
  }
  return phrases;
}

const LATER: PhraseBudget = { maxChars: 96, overrunChars: 24 };

describe('cutPhrase', () => {
  test('a sentence that fits the budget is spoken whole', () => {
    expect(cutPhrase(['What would you try first?'], FIRST_PHRASE_BUDGET)).toEqual({
      phrase: 'What would you try first?',
      rest: [],
    });
  });

  test('never merges sentences', () => {
    const cut = cutPhrase(['Nice!', 'Tell me more.'], FIRST_PHRASE_BUDGET);

    expect(cut).toEqual({ phrase: 'Nice!', rest: ['Tell me more.'] });
  });

  test('returns nothing when no text is pending', () => {
    expect(cutPhrase([], FIRST_PHRASE_BUDGET)).toBeNull();
  });

  test('a long sentence breaks at the last clause boundary inside the budget', () => {
    const sentence =
      'That sounds like a useful approach, and it could save you a lot of time at work.';

    const cut = cutPhrase([sentence], FIRST_PHRASE_BUDGET);

    expect(cut?.phrase).toBe('That sounds like a useful approach,');
    expect(cut?.rest).toEqual(['and it could save you a lot of time at work.']);
  });

  test('the first phrase never runs past its budget even when a later comma would be nicer', () => {
    const sentence =
      'I usually start by breaking the problem down into smaller steps, so I can make steady progress.';

    const cut = cutPhrase([sentence], FIRST_PHRASE_BUDGET);

    expect(cut?.phrase.length).toBeLessThanOrEqual(40);
  });

  test('a later phrase may overrun its budget to reach a clause boundary', () => {
    const sentence = `${'word '.repeat(19)}end, and then the sentence goes on for a while longer than that.`;

    const cut = cutPhrase([sentence], { maxChars: 96, overrunChars: 24 });

    expect(cut?.phrase.endsWith('end,')).toBe(true);
  });

  test('never leaves a trailing fragment shorter than the minimum', () => {
    const sentence = `${'word '.repeat(12)}and ok.`;

    const phrases = phrasesOf([sentence], FIRST_PHRASE_BUDGET);

    expect(phrases.every((phrase, index) => index === 0 || phrase.length >= 16)).toBe(true);
  });

  test('an oversized single token stays whole', () => {
    const token = 'a'.repeat(200);

    expect(cutPhrase([token], FIRST_PHRASE_BUDGET)).toEqual({ phrase: token, rest: [] });
  });

  test.each([
    'I understand, learning a new language can feel slow sometimes. But you are making real progress, and your sentences are getting longer. Which topic would you like to practise next, or should we review the words from yesterday?',
    'Nice! Cooking at home is cheaper and healthier, but it takes time. What is your favourite dish to make when you have friends over for dinner on the weekend?',
  ])('every word of the reply is kept exactly once: %s', (reply) => {
    const sentences = reply.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()) ?? [];

    const phrases = phrasesOf(sentences, LATER);

    expect(phrases.join(' ')).toBe(sentences.join(' '));
    expect(phrases.every((phrase) => phrase.length <= 96 + 24)).toBe(true);
  });
});

describe('laterPhraseBudget', () => {
  test('a long lead affords the longest phrase', () => {
    expect(laterPhraseBudget(5000, INITIAL_SYNTHESIS_ESTIMATE).maxChars).toBe(120);
  });

  test('a short lead shrinks the phrase but never below the floor', () => {
    const short = laterPhraseBudget(2000, INITIAL_SYNTHESIS_ESTIMATE).maxChars;
    const none = laterPhraseBudget(0, INITIAL_SYNTHESIS_ESTIMATE).maxChars;

    expect(short).toBeGreaterThan(none);
    expect(none).toBe(32);
  });

  test('a slower engine gets shorter phrases for the same lead', () => {
    const fast = laterPhraseBudget(2500, { fixedMs: 250, perCharMs: 8 }).maxChars;
    const slow = laterPhraseBudget(2500, { fixedMs: 250, perCharMs: 20 }).maxChars;

    expect(slow).toBeLessThan(fast);
  });
});
