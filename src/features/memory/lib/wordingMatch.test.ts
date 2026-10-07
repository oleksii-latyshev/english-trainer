// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { hasWording, highlightWording } from './wordingMatch';

describe('highlightWording', () => {
  it('marks the target inside the transcript and keeps the text around it', () => {
    expect(
      highlightWording("I've been working on", "Honestly, I've been working on the refunds flow."),
    ).toEqual([
      { text: 'Honestly, ', isMatch: false },
      { text: "I've been working on", isMatch: true },
      { text: ' the refunds flow.', isMatch: false },
    ]);
  });

  it('matches whole words in order, ignoring case and punctuation like the Rust check', () => {
    expect(highlightWording('trade-off', 'The Trade, off matters.')[1]).toEqual({
      text: 'Trade, off',
      isMatch: true,
    });
    expect(hasWording(highlightWording('trade-off', 'I noticed a trade today.'))).toBe(false);
    expect(hasWording(highlightWording('work', 'The workshop helped.'))).toBe(false);
  });

  it('marks every occurrence and returns the whole text when nothing matches', () => {
    expect(highlightWording('very', 'very very good').filter((s) => s.isMatch)).toHaveLength(2);
    expect(highlightWording('other words', 'Nothing here')).toEqual([
      { text: 'Nothing here', isMatch: false },
    ]);
    expect(highlightWording('', 'Anything')).toEqual([{ text: 'Anything', isMatch: false }]);
    expect(highlightWording('anything', '')).toEqual([]);
  });

  it('matches "…" pieces in order with a short gap, like the Rust check', () => {
    expect(
      highlightWording("I'd rather … than …", "Honestly I'd rather do it than patch it"),
    ).toEqual([
      { text: 'Honestly ', isMatch: false },
      { text: "I'd rather", isMatch: true },
      { text: ' do it ', isMatch: false },
      { text: 'than', isMatch: true },
      { text: ' patch it', isMatch: false },
    ]);
    expect(
      hasWording(highlightWording('the tricky part was ...', 'Honestly the tricky part was it')),
    ).toBe(true);
    expect(hasWording(highlightWording("I'd rather … than …", "Than that, I'd rather wait."))).toBe(
      false,
    );
    expect(
      hasWording(
        highlightWording(
          "I'd rather … than …",
          "I'd rather wait for the next sprint and the review of the whole design than rush.",
        ),
      ),
    ).toBe(false);
    expect(hasWording(highlightWording('…', 'anything'))).toBe(false);
  });
});
