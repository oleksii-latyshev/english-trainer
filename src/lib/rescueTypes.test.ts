// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { isRescueResponse } from './rescueTypes';

describe('isRescueResponse', () => {
  it('accepts the expected next step and simpler variants', () => {
    expect(
      isRescueResponse(
        { kind: 'next_step', suggestion: 'One reason is the shorter commute.' },
        'next_step',
      ),
    ).toBe(true);
    expect(
      isRescueResponse({ kind: 'simpler', suggestion: 'I like working from home.' }, 'simpler'),
    ).toBe(true);
  });

  it('accepts three to five distinct English words or terms', () => {
    expect(
      isRescueResponse(
        { kind: 'missing_word', candidates: ['library', 'book shop', "reader's card"] },
        'missing_word',
      ),
    ).toBe(true);
    expect(
      isRescueResponse(
        { kind: 'missing_word', candidates: ['a', 'b', 'c', 'd', 'e', 'f'] },
        'missing_word',
      ),
    ).toBe(false);
  });

  it('rejects wrong variants, extra fields, translated or marked up suggestions', () => {
    expect(isRescueResponse({ kind: 'simpler', suggestion: 'Try this.' }, 'next_step')).toBe(false);
    for (const suggestion of [
      'Поэтому я думаю так.',
      '**One reason is the commute.**',
      '- One reason is the commute.',
      '1. Try this idea.',
      'A café nearby.',
      '\nOne reason is the flexibility.',
      `This answer ${'is '.repeat(30)}too long.`,
    ]) {
      expect(isRescueResponse({ kind: 'next_step', suggestion }, 'next_step')).toBe(false);
    }
    expect(
      isRescueResponse({ kind: 'next_step', suggestion: 'Try this.', extra: true }, 'next_step'),
    ).toBe(false);
  });

  it('rejects duplicate candidates and candidate explanations', () => {
    expect(
      isRescueResponse(
        { kind: 'missing_word', candidates: ['library', 'Library', 'reading room'] },
        'missing_word',
      ),
    ).toBe(false);
    expect(
      isRescueResponse(
        { kind: 'missing_word', candidates: ['library', 'a place for books', 'reading room'] },
        'missing_word',
      ),
    ).toBe(false);
    expect(isRescueResponse(null, 'missing_word')).toBe(false);
    expect(
      isRescueResponse(
        { kind: 'missing_word', candidates: ['book\nshop', 'library', 'reading room'] },
        'missing_word',
      ),
    ).toBe(false);
  });
});
