// @ts-expect-error Bun provides this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { mistakePracticeProgress } from './mistakePracticeProgress';

describe('usual-mistake practice progress', () => {
  it('names the current question and approximate length', () => {
    expect(mistakePracticeProgress(0, 5)).toEqual({
      label: 'Question 1 of 5 · About 2 minutes',
      value: 1,
      percent: 20,
      isComplete: false,
    });
  });

  it('ends at five and reports completion without another question', () => {
    expect(mistakePracticeProgress(5, 5)).toEqual({
      label: 'Practice complete',
      value: 5,
      percent: 100,
      isComplete: true,
    });
  });
});
