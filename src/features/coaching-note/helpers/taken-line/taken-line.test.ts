import { describe, expect, it } from 'bun:test';
import { takenLine } from '.';

describe('takenLine', () => {
  it('counts the taken words against the words offered', () => {
    expect(takenLine(2, 4)).toBe('2 of 4 taken');
  });

  it('says 5 of 5 when the cap of the session is reached', () => {
    expect(takenLine(5, 5)).toBe('5 of 5 taken');
  });
});
