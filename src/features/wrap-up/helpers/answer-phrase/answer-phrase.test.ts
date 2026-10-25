import { describe, expect, it } from 'bun:test';
import { phraseToSave } from './index';

const feedback = {
  focus_feedback: [
    {
      improved: 'every bank sends',
      explanation: 'After “every bank” the verb takes -s.',
    },
  ],
  b2_rewrite: 'Every bank sends them in a different format.',
};

describe('phraseToSave', () => {
  it('saves the improved wording with its explanation', () => {
    expect(phraseToSave(feedback)).toEqual({
      phrase: 'every bank sends',
      note: 'After “every bank” the verb takes -s.',
    });
  });

  it('saves the natural rewrite when there is no focus point', () => {
    expect(phraseToSave({ ...feedback, focus_feedback: [] })).toEqual({
      phrase: 'Every bank sends them in a different format.',
      note: 'Stronger phrasing from conversation feedback',
    });
  });

  it('has nothing to save when the phrase is too long for a Memory card', () => {
    expect(phraseToSave({ focus_feedback: [], b2_rewrite: 'word '.repeat(70).trim() })).toBeNull();
  });
});
