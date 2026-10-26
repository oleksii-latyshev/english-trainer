import { describe, expect, test } from 'bun:test';
import { modeLabel, originalQuestionLabel, reviewCopy } from './index';

describe('reviewCopy', () => {
  test('titles the writing and speaking reviews', () => {
    expect(reviewCopy('writing_review').title).toBe('Review writing');
    expect(reviewCopy('speaking_review').title).toBe('Review speaking');
  });
});

describe('modeLabel', () => {
  test('names the text chat and the write then speak mode', () => {
    expect(modeLabel('text_chat')).toBe('Text chat');
    expect(modeLabel('write_then_speak')).toBe('Write, then speak');
  });
});

describe('originalQuestionLabel', () => {
  test('counts the question being replayed', () => {
    expect(originalQuestionLabel(false, 1, 3)).toBe('Original question 2 of 3');
  });

  test('says the replay is complete', () => {
    expect(originalQuestionLabel(true, 3, 3)).toBe('Replay complete');
  });
});
