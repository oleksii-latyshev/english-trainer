import { describe, expect, it } from 'bun:test';
import { deriveCoachStep } from './coachState';

describe('Coach loop guidance', () => {
  const empty = {
    hasSession: true,
    hasTranscript: false,
    savedAnswer: null,
    retryAnchor: null,
    isRetrying: false,
    hasComparison: false,
  };

  it('asks the user to save an unsent transcript before reviewing it', () => {
    expect(deriveCoachStep({ ...empty, hasTranscript: true })).toBe(2);
  });

  it('moves to feedback only after an answer is saved', () => {
    expect(deriveCoachStep({ ...empty, savedAnswer: { sessionId: 1 } })).toBe(3);
  });

  it('shows comparison after a saved retry', () => {
    expect(deriveCoachStep({ ...empty, isRetrying: true, hasComparison: true })).toBe(5);
  });
});
