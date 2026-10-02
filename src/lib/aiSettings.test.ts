// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { expect, it } from 'bun:test';
import { DEFAULT_AI_SETTINGS, isAiSettings } from './aiSettings';

it('accepts valid persisted settings and defaults', () => {
  expect(isAiSettings(DEFAULT_AI_SETTINGS)).toBe(true);
  expect(isAiSettings({ provider: 'apple', agy_model: 'gemini-3.8-flash-high' })).toBe(true);
});

it('rejects invalid provider and model types at the IPC boundary', () => {
  expect(isAiSettings({ provider: 'unknown', agy_model: 'default' })).toBe(false);
  expect(isAiSettings({ provider: 'agy', agy_model: 42 })).toBe(false);
  expect(isAiSettings(null)).toBe(false);
});
