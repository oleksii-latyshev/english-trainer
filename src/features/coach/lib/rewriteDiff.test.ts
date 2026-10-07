// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { highlightRewrite } from './rewriteDiff';

function changedText(original: string, rewrite: string): string[] {
  return highlightRewrite(original, rewrite)
    .filter((part) => part.isChanged)
    .map((part) => part.text);
}

describe('highlightRewrite', () => {
  it('marks only the words the learner did not say', () => {
    expect(
      changedText(
        'The hardest part was the refunds, because every bank send it in different format.',
        'The hardest part was refunds, because every bank sends them in a different format.',
      ),
    ).toEqual(['sends them', 'a']);
  });

  it('keeps the rewrite text intact', () => {
    const rewrite = "I've been working on a new feature.";
    const parts = highlightRewrite('I am working on feature', rewrite);
    expect(parts.map((part) => part.text).join('')).toBe(rewrite);
  });

  it('ignores case and punctuation when matching words', () => {
    expect(changedText('i like coffee', 'I like coffee.')).toEqual([]);
    expect(changedText('it’s fine', "It's fine")).toEqual([]);
  });

  it('highlights nothing when the original is empty, so a rewrite is never all marked', () => {
    expect(highlightRewrite('', 'Hello there.')).toEqual([
      { text: 'Hello there.', isChanged: false },
    ]);
    expect(highlightRewrite('Hello', '')).toEqual([]);
  });

  it('marks a whole new phrase as one run', () => {
    expect(changedText('We talk', 'We have been talking')).toEqual(['have been talking']);
  });
});
