// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { isGuidedAnswer } from './guidedAnswerTypes';

describe('guided answer IPC', () => {
  const answer = {
    model_answer: 'I am working on a small app. It helps me practise English.',
    adaptation: 'I am working on [a project]. It helps [someone] do [something].',
  };
  it('requires a usable answer and editable details', () => {
    expect(isGuidedAnswer(answer)).toBe(true);
    expect(isGuidedAnswer({ ...answer, adaptation: 'No editable details.' })).toBe(false);
    expect(isGuidedAnswer({ ...answer, model_answer: 'word '.repeat(61) })).toBe(false);
    expect(isGuidedAnswer({ ...answer, model_answer: '```json {} ```' })).toBe(false);
    expect(isGuidedAnswer({ ...answer, adaptation: null })).toBe(false);
    expect(isGuidedAnswer(null)).toBe(false);
  });
});
