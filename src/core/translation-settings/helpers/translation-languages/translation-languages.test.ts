import { expect, it } from 'bun:test';
import { isTranslationLanguage, TRANSLATION_LANGUAGES } from '.';

it('offers the eleven supported native languages', () => {
  expect(TRANSLATION_LANGUAGES.map((language) => language.value)).toEqual([
    'ru',
    'uk',
    'de',
    'fr',
    'es',
    'it',
    'pt',
    'ja',
    'ko',
    'zh-Hans',
    'ar',
  ]);
});

it('recognises only the supported codes', () => {
  expect(isTranslationLanguage('zh-Hans')).toBe(true);
  expect(isTranslationLanguage('en')).toBe(false);
  expect(isTranslationLanguage('')).toBe(false);
});
