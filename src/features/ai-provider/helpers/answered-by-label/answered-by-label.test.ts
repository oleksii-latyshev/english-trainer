import { expect, it } from 'bun:test';
import { answeredByLabel } from '.';

it('names the Gemini model, with a friendly name for the conversation model', () => {
  expect(
    answeredByLabel({ provider: 'gemini', model: 'gemini-3.5-flash-lite', is_backup: false }),
  ).toBe('Gemini 3.5 Flash-Lite');
  expect(answeredByLabel({ provider: 'gemini', model: 'gemini-x', is_backup: false })).toBe(
    'gemini-x',
  );
});

it('marks Apple on-device replies that stood in for the chosen provider', () => {
  expect(answeredByLabel({ provider: 'apple', model: 'm', is_backup: true })).toBe(
    'Apple on-device (backup)',
  );
  expect(answeredByLabel({ provider: 'apple', model: 'm', is_backup: false })).toBe(
    'Apple on-device',
  );
});

it('names the Antigravity model unless it is the default', () => {
  expect(answeredByLabel({ provider: 'agy', model: 'default', is_backup: false })).toBe(
    'Antigravity CLI',
  );
  expect(
    answeredByLabel({ provider: 'agy', model: 'gemini-3.8-flash-low', is_backup: false }),
  ).toBe('Antigravity CLI (gemini-3.8-flash-low)');
});
