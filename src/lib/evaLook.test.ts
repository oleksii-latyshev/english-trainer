// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { DEFAULT_EVA_LOOK, evaLookCssVars, parseEvaLook, withSphere } from './evaLook';

describe('Eva look preference', () => {
  it('uses the pearl defaults for missing or malformed values', () => {
    for (const value of [undefined, null, 3, [], 'pearl']) {
      expect(parseEvaLook(value)).toEqual(DEFAULT_EVA_LOOK);
    }
  });

  it('keeps valid fields and replaces unknown ones individually', () => {
    expect(parseEvaLook({ sphere: 'mint', eye: 'neon', motion: 'still' })).toEqual({
      sphere: 'mint',
      eye: 'ink',
      motion: 'still',
    });
  });

  it('a sphere choice brings the eyes that suit it', () => {
    const graphite = withSphere(DEFAULT_EVA_LOOK, 'graphite');
    expect(graphite.eye).toBe('moonlight');
    expect(withSphere(graphite, 'peach').eye).toBe('ink');
  });

  it('exposes the sphere stops and eye colour as the variables Eva reads', () => {
    const vars = evaLookCssVars({ sphere: 'sky', eye: 'navy', motion: 'full' });
    expect(vars['--shell-1']).toBe('#E8F2FC');
    expect(vars['--shell-3']).toBe('#9DB9DC');
    expect(vars['--eye-color']).toBe('#1D2B5A');
  });
});
