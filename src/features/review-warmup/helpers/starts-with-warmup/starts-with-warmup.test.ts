import { expect, it } from 'bun:test';
import { canOfferWarmup, startsWithWarmup } from './index';

const PHRASE = { phrase: 'most of our users' };

it('starts with a warm-up only when chosen, spoken and a phrase is due', () => {
  expect(startsWithWarmup({ mode: 'voice', nextPhrase: PHRASE, warmupFirst: true })).toBe(true);
  expect(startsWithWarmup({ mode: 'voice', nextPhrase: PHRASE, warmupFirst: false })).toBe(false);
  expect(startsWithWarmup({ mode: 'voice', nextPhrase: undefined, warmupFirst: true })).toBe(false);
});

it('never warms up before writing modes', () => {
  expect(startsWithWarmup({ mode: 'text_chat', nextPhrase: PHRASE, warmupFirst: true })).toBe(
    false,
  );
  expect(
    startsWithWarmup({ mode: 'write_then_speak', nextPhrase: PHRASE, warmupFirst: true }),
  ).toBe(false);
});

it('offers the choice only before a spoken conversation with a due phrase', () => {
  expect(canOfferWarmup({ mode: 'voice', nextPhrase: PHRASE })).toBe(true);
  expect(canOfferWarmup({ mode: 'text_chat', nextPhrase: PHRASE })).toBe(false);
});
