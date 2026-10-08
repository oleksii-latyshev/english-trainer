// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { expect, it } from 'bun:test';
import { DEFAULT_AI_SETTINGS, isAiSettings } from './aiSettings';

it('accepts valid persisted settings and defaults', () => {
  expect(isAiSettings(DEFAULT_AI_SETTINGS)).toBe(true);
  expect(
    isAiSettings({
      provider: 'apple',
      agy_model: 'gemini-3.8-flash-high',
      eva_style: 'short_and_simple',
    }),
  ).toBe(true);
});

it('rejects invalid provider and model types at the IPC boundary', () => {
  expect(isAiSettings({ provider: 'unknown', agy_model: 'default', eva_style: 'natural' })).toBe(
    false,
  );
  expect(isAiSettings({ provider: 'agy', agy_model: 42, eva_style: 'natural' })).toBe(false);
  expect(isAiSettings(null)).toBe(false);
});

it('accepts Gemini and defaults fresh installs to it', () => {
  expect(DEFAULT_AI_SETTINGS.provider).toBe('gemini');
  expect(isAiSettings({ provider: 'gemini', agy_model: 'default', eva_style: 'natural' })).toBe(
    true,
  );
});

it('defaults Eva to the natural style and rejects an unknown style', () => {
  expect(DEFAULT_AI_SETTINGS.eva_style).toBe('natural');
  expect(isAiSettings({ provider: 'gemini', agy_model: 'default', eva_style: 'chatty' })).toBe(
    false,
  );
  expect(isAiSettings({ provider: 'gemini', agy_model: 'default' })).toBe(false);
});
