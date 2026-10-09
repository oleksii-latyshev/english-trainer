// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import { isCurrentTranslationResult } from './translationRequest';

const request = {
  requestId: 4,
  currentId: 4,
  isPanelOpen: true,
  requestPath: '/conversation',
  currentPath: '/conversation',
  resultWord: 'Quiet',
  requestedWord: 'quiet',
};

describe('translation request freshness', () => {
  it('accepts the latest matching result on the open route', () => {
    expect(isCurrentTranslationResult(request)).toBe(true);
  });

  it('rejects late, closed, navigated, or mismatched results', () => {
    expect(isCurrentTranslationResult({ ...request, requestId: 3 })).toBe(false);
    expect(isCurrentTranslationResult({ ...request, isPanelOpen: false })).toBe(false);
    expect(isCurrentTranslationResult({ ...request, currentPath: '/memory' })).toBe(false);
    expect(isCurrentTranslationResult({ ...request, resultWord: 'other' })).toBe(false);
  });
});
