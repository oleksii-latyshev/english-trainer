// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import { type AnsweredBy, answeredByLabel, isAnsweredBy, isOptionalAnsweredBy } from './answeredBy';

const gemini: AnsweredBy = { provider: 'gemini', model: 'gemini-3.5-flash-lite', is_backup: false };

describe('answeredByLabel', () => {
  it('names Gemini models, the on-device model and its backup role', () => {
    expect(answeredByLabel(gemini)).toBe('Gemini 3.5 Flash-Lite');
    expect(answeredByLabel({ ...gemini, model: 'gemini-9' })).toBe('gemini-9');
    expect(
      answeredByLabel({ provider: 'apple', model: 'apple-foundation-models', is_backup: false }),
    ).toBe('Apple on-device');
    expect(
      answeredByLabel({ provider: 'apple', model: 'apple-foundation-models', is_backup: true }),
    ).toBe('Apple on-device (backup)');
  });

  it('names the legacy Antigravity provider with its model', () => {
    expect(answeredByLabel({ provider: 'agy', model: 'default', is_backup: false })).toBe(
      'Antigravity CLI',
    );
    expect(
      answeredByLabel({ provider: 'agy', model: 'gemini-3.8-flash-low', is_backup: false }),
    ).toBe('Antigravity CLI (gemini-3.8-flash-low)');
  });
});

describe('isOptionalAnsweredBy', () => {
  it('accepts missing, null and well-formed values', () => {
    expect(isOptionalAnsweredBy(undefined)).toBe(true);
    expect(isOptionalAnsweredBy(null)).toBe(true);
    expect(isOptionalAnsweredBy(gemini)).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isAnsweredBy({ provider: 'openai', model: 'x', is_backup: false })).toBe(false);
    expect(isAnsweredBy({ provider: 'gemini', model: '', is_backup: false })).toBe(false);
    expect(isAnsweredBy({ provider: 'gemini', model: 'x' })).toBe(false);
    expect(isOptionalAnsweredBy('gemini')).toBe(false);
  });
});
