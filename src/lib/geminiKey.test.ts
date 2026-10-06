// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { expect, it } from 'bun:test';
import { isGeminiKeyStatus } from './geminiKey';

it('accepts only consistent key status shapes', () => {
  expect(isGeminiKeyStatus({ configured: true, source: 'settings' })).toBe(true);
  expect(isGeminiKeyStatus({ configured: true, source: 'environment' })).toBe(true);
  expect(isGeminiKeyStatus({ configured: false, source: null })).toBe(true);
  expect(isGeminiKeyStatus({ configured: false, source: 'settings' })).toBe(false);
  expect(isGeminiKeyStatus({ configured: true, source: null })).toBe(false);
  expect(isGeminiKeyStatus({ configured: true })).toBe(false);
});
