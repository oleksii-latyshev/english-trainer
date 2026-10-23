import { describe, expect, it } from 'bun:test';
import { stageActionFor } from '.';

describe('the stage action in the header', () => {
  it('offers Review writing once something was written', () => {
    expect(
      stageActionFor({ mode: 'text_chat', phase: 'writing', writtenCount: 1, spokenCount: 0 }),
    ).toEqual({ label: 'Review writing', target: 'writing_review' });
  });

  it('offers nothing before the first written answer', () => {
    expect(
      stageActionFor({ mode: 'text_chat', phase: 'writing', writtenCount: 0, spokenCount: 0 }),
    ).toBeUndefined();
  });

  it('offers Review speaking after every original question was spoken', () => {
    const stage = { mode: 'write_then_speak', phase: 'speaking', writtenCount: 2 } as const;
    expect(stageActionFor({ ...stage, spokenCount: 2 })?.target).toBe('speaking_review');
    expect(stageActionFor({ ...stage, spokenCount: 1 })).toBeUndefined();
  });

  it('never offers a review in a voice session', () => {
    expect(
      stageActionFor({ mode: 'voice', phase: 'speaking', writtenCount: 0, spokenCount: 0 }),
    ).toBeUndefined();
  });
});
