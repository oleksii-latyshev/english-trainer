import { describe, expect, it } from 'bun:test';
import { AUTO_SEND_OPTIONS, END_PAUSE_OPTIONS } from './index';

describe('flow options', () => {
  it('labels the end-of-turn pauses in seconds', () => {
    expect(END_PAUSE_OPTIONS.map((option) => option.label)).toEqual(['1 s', '1.5 s', '2 s', '3 s']);
  });

  it('offers auto-send off first, then the edit windows', () => {
    expect(AUTO_SEND_OPTIONS.map((option) => option.label)).toEqual(['Off', '1 s', '2 s', '3 s']);
  });
});
