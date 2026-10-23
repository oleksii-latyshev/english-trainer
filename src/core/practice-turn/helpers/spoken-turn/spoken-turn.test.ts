import { describe, expect, it } from 'bun:test';
import { spokenDurationMs, spokenTurn } from '.';

describe('what Eva says out loud', () => {
  it('joins the reply and the next question', () => {
    expect(spokenTurn({ spoken_reply: 'Nice.', question: 'Why?' })).toBe('Nice. Why?');
  });

  it('says only the reply when there is no question', () => {
    expect(spokenTurn({ spoken_reply: 'Well done.', question: null })).toBe('Well done.');
  });
});

describe('the spoken length sent with an answer', () => {
  it('is sent for voice and edited answers only', () => {
    expect(spokenDurationMs('voice', 14_000.4)).toBe(14_000);
    expect(spokenDurationMs('edited', 9_000)).toBe(9_000);
    expect(spokenDurationMs('text', 9_000)).toBeUndefined();
    expect(spokenDurationMs(undefined, 9_000)).toBeUndefined();
    expect(spokenDurationMs('voice', 0)).toBeUndefined();
  });
});
