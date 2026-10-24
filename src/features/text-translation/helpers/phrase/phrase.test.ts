import { describe, expect, it } from 'bun:test';
import { boundedContext, MAX_PHRASE_CHARS, normalizePhrase } from './index';

describe('normalizePhrase', () => {
  it('trims outer punctuation and normalises apostrophes of a single word', () => {
    expect(normalizePhrase('  “don’t,”  ')).toBe("don't");
    expect(normalizePhrase('‘don’t’')).toBe("don't");
  });

  it('accepts a phrase of up to eight words and collapses whitespace', () => {
    expect(normalizePhrase('I have  been working\nhere, really.')).toBe(
      'I have been working here, really',
    );
    expect(normalizePhrase('one two three four five six seven eight')).toBe(
      'one two three four five six seven eight',
    );
    expect(normalizePhrase('one two three four five six seven eight nine')).toBeUndefined();
  });

  it('rejects a phrase over the character limit', () => {
    expect(normalizePhrase('a'.repeat(MAX_PHRASE_CHARS))).toBeDefined();
    expect(normalizePhrase('a'.repeat(MAX_PHRASE_CHARS + 1))).toBeUndefined();
  });

  it('rejects non-English, empty and malformed selections', () => {
    for (const value of ['café', 'привет', '', '  ', '...', '2020', '-word', 'word-', 'a--b']) {
      expect(normalizePhrase(value)).toBeUndefined();
    }
  });

  it('rejects control characters', () => {
    expect(normalizePhrase('bad\u0000word')).toBeUndefined();
  });
});

describe('boundedContext', () => {
  it('collapses whitespace and limits the length', () => {
    expect(boundedContext('  a\n\n b\tc ')).toBe('a b c');
    expect(boundedContext('x'.repeat(600))).toHaveLength(500);
  });

  it('replaces control characters with spaces', () => {
    expect(boundedContext('a\u0000b')).toBe('a b');
  });
});
