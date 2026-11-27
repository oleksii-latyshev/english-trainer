import { describe, expect, it } from 'bun:test';
import { offeredWord } from '.';

const offered = [{ sequence: 2, phrase: 'Back Up And Running', meaning: 'working', example: 'x' }];

describe('offeredWord', () => {
  it('finds the offered word whatever its case', () => {
    expect(offeredWord(offered, ' back up and running ')).toBe(offered[0]);
  });

  it('finds nothing for a word that is not among the offered five', () => {
    expect(offeredWord(offered, 'incident report')).toBeUndefined();
  });
});
