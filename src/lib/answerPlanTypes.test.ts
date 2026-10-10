// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { isAnswerPlan } from './answerPlanTypes';

const valid = {
  frame: ['State your view', 'Give a reason', 'Share an example'],
  phrases: ['From my perspective', 'One reason is', 'For example'],
  model_answer:
    'I prefer remote work because it gives me quiet time. For example, I can focus without a long commute.',
  adaptation: 'I prefer [work style] because [reason]. For example, [personal example].',
};

describe('isAnswerPlan', () => {
  it('accepts a complete plan and enforces each field count and limit', () => {
    expect(isAnswerPlan(valid)).toBe(true);
    expect(isAnswerPlan({ ...valid, frame: ['one', 'two'] })).toBe(false);
    expect(isAnswerPlan({ ...valid, phrases: ['one', 'two'] })).toBe(false);
    expect(isAnswerPlan({ ...valid, phrases: [...valid.phrases, 'four', 'five', 'six'] })).toBe(
      false,
    );
    expect(isAnswerPlan({ ...valid, model_answer: 'answer '.repeat(61) })).toBe(false);
    expect(isAnswerPlan({ ...valid, extra: true })).toBe(false);
  });

  it('rejects unsafe provider text at the IPC boundary', () => {
    for (const model_answer of [
      'Bad café example.',
      'Bad\nexample.',
      '**formatted** example.',
      '*formatted* example.',
      '## heading',
      '<b>formatted</b>',
      '- list item',
      '1. list item',
      '1) list item',
      '+ list item',
      'link](https://example.com)',
      '[bracketed] example.',
      'No ending punctuation',
    ]) {
      expect(isAnswerPlan({ ...valid, model_answer })).toBe(false);
    }
    expect(isAnswerPlan({ ...valid, adaptation: 'No replaceable detail.' })).toBe(false);
    expect(isAnswerPlan(null)).toBe(false);
  });
});
