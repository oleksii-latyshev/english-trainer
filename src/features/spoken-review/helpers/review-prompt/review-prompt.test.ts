import { describe, expect, it } from 'bun:test';
import { reviewPrompt } from './index';

describe('review prompt', () => {
  it('gives a phrase cue as a situation', () => {
    expect(reviewPrompt('phrase', 'A friend asks about your move.')).toEqual({
      label: 'Eva · situation',
      text: 'A friend asks about your move.',
      spoken: 'Here is a situation. A friend asks about your move.',
    });
  });

  it('asks for a mistake to be said better instead of reading it as a model', () => {
    const prompt = reviewPrompt('mistake', 'I work in there yesterday.');
    expect(prompt.label).toBe('Eva · say it better');
    expect(prompt.spoken).toBe('Say this one better. I work in there yesterday.');
  });

  it('introduces generated situations as context even for a mistake item', () => {
    const prompt = reviewPrompt('mistake', 'A coworker asks what happened.', true);
    expect(prompt.label).toBe('Eva · situation');
    expect(prompt.spoken).toBe('Here is a situation. A coworker asks what happened.');
  });
});
