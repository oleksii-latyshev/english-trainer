// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import {
  boundedTranslationContext,
  isSafeTranslationContext,
  isTranslationError,
  isTranslationLanguage,
  isTranslationStatus,
  isWordTranslation,
  matchesTranslationWord,
  normalizeEnglishWord,
} from './translationTypes';

describe('translation boundary guards', () => {
  it('normalizes only a single bounded English word', () => {
    expect(normalizeEnglishWord("  don't  ")).toBe("don't");
    expect(normalizeEnglishWord('“can’t,”')).toBe("can't");
    expect(normalizeEnglishWord('can‘t')).toBe("can't");
    expect(normalizeEnglishWord('-well-being')).toBeUndefined();
    expect(normalizeEnglishWord('well-being-')).toBeUndefined();
    expect(normalizeEnglishWord('word\n')).toBeUndefined();
    expect(normalizeEnglishWord('well-being')).toBe('well-being');
    expect(normalizeEnglishWord('two words')).toBeUndefined();
    expect(normalizeEnglishWord('café')).toBeUndefined();
    expect(normalizeEnglishWord('a'.repeat(65))).toBeUndefined();
  });

  it('accepts known native languages and bounded safe context', () => {
    expect(isTranslationLanguage('ru')).toBe(true);
    expect(isTranslationLanguage('en')).toBe(false);
    expect(isSafeTranslationContext(`line one\nline two\t${'x'.repeat(480)}`)).toBe(true);
    expect(isSafeTranslationContext('word\u0000')).toBe(false);
    expect(isSafeTranslationContext('x'.repeat(501))).toBe(false);
    expect(boundedTranslationContext(` first\nsecond\t${'x'.repeat(510)}`)).toHaveLength(500);
    expect(matchesTranslationWord('“Quiet!”', 'quiet')).toBe(true);
    expect(matchesTranslationWord('different', 'quiet')).toBe(false);
  });

  it('rejects malformed statuses, errors and translation results', () => {
    expect(
      isTranslationStatus({ native_language: 'ru', status: 'download_required', message: 'Ready' }),
    ).toBe(true);
    expect(
      isTranslationStatus({ native_language: 'ru', status: 'unknown', message: 'Ready' }),
    ).toBe(false);
    expect(
      isTranslationStatus({ native_language: 'en', status: 'installed', message: 'Ready' }),
    ).toBe(false);
    expect(isTranslationError({ code: 'timeout', message: 'Try again.' })).toBe(true);
    expect(isTranslationError({ code: 'other', message: 'Try again.' })).toBe(false);
    expect(
      isWordTranslation({
        word: 'quiet',
        native_language: 'ru',
        translation: 'тихий',
        english_explanation: 'Making little noise.',
        explanation_error: null,
      }),
    ).toBe(true);
    expect(
      isWordTranslation({
        word: 'quiet',
        native_language: 'ru',
        translation: 'тихий',
        english_explanation: null,
        explanation_error: null,
      }),
    ).toBe(false);
    expect(
      isWordTranslation({
        word: 'quiet',
        native_language: 'en',
        translation: 'quiet',
        english_explanation: 'Making little noise.',
        explanation_error: null,
      }),
    ).toBe(false);
    expect(
      isWordTranslation({
        word: 'quiet',
        native_language: 'ru',
        translation: 'тихий',
        english_explanation: 'Making little noise.',
        explanation_error: 'No explanation.',
      }),
    ).toBe(false);
  });
});
