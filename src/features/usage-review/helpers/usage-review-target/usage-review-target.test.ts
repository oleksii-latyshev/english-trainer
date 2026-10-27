import { describe, expect, it } from 'bun:test';
import { type UsageReviewInput, usageReviewTarget } from './index';

function anInput(overrides: Partial<UsageReviewInput> = {}): UsageReviewInput {
  return {
    answer: { sessionId: 7, sequence: 1 },
    session: { sessionId: 7, practiceMode: 'voice', isMistakePractice: false },
    dialogue: { input_sources: ['voice'] },
    isBlocked: false,
    ...overrides,
  };
}

describe('usageReviewTarget', () => {
  it('offers the review for a spoken answer, even when it used help', () => {
    expect(usageReviewTarget(anInput())).toEqual({ sessionId: 7, sequence: 1 });
  });

  it('needs no capture state, so it survives the reset that follows sending', () => {
    const afterReset = anInput({ answer: { sessionId: 7, sequence: 2 } });
    const withBoth = {
      ...afterReset,
      dialogue: { input_sources: ['text', 'voice'] },
    };
    expect(usageReviewTarget(withBoth)).toEqual({ sessionId: 7, sequence: 2 });
  });

  it('stays hidden without an accepted answer', () => {
    expect(usageReviewTarget(anInput({ answer: null }))).toBeNull();
  });

  it('stays hidden for an answer of another session', () => {
    expect(usageReviewTarget(anInput({ answer: { sessionId: 6, sequence: 1 } }))).toBeNull();
  });

  it('reviews only the first two answers', () => {
    const third = anInput({
      answer: { sessionId: 7, sequence: 3 },
      dialogue: { input_sources: ['voice', 'voice', 'voice'] },
    });
    expect(usageReviewTarget(third)).toBeNull();
  });

  it('skips typed and edited answers', () => {
    expect(usageReviewTarget(anInput({ dialogue: { input_sources: ['text'] } }))).toBeNull();
    expect(usageReviewTarget(anInput({ dialogue: { input_sources: ['edited'] } }))).toBeNull();
  });

  it('skips mistake practice, other modes and a blocked screen', () => {
    const session = { sessionId: 7, practiceMode: 'voice', isMistakePractice: true };
    expect(usageReviewTarget(anInput({ session }))).toBeNull();
    expect(
      usageReviewTarget(
        anInput({ session: { sessionId: 7, practiceMode: 'text_chat', isMistakePractice: false } }),
      ),
    ).toBeNull();
    expect(usageReviewTarget(anInput({ isBlocked: true }))).toBeNull();
  });

  it('waits until the dialogue has the answer', () => {
    expect(usageReviewTarget(anInput({ dialogue: null }))).toBeNull();
  });
});
