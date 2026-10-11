import { expect, it } from 'bun:test';
import { DEFAULT_EVA_LOOK, type EvaLook } from '../../palette';
import { parseEvaLook } from '.';

it('falls back to the default look for anything that is not a record', () => {
  expect(parseEvaLook(undefined)).toEqual(DEFAULT_EVA_LOOK);
  expect(parseEvaLook('mint')).toEqual(DEFAULT_EVA_LOOK);
  expect(parseEvaLook([])).toEqual(DEFAULT_EVA_LOOK);
});

it('keeps a stored look written in the new shape', () => {
  const stored: EvaLook = {
    body: 'mint',
    ink: 'plum',
    leaf: 'sky',
    petal: 'lilac',
    motion: 'gentle',
  };
  expect(parseEvaLook(stored)).toEqual(stored);
});

it('reads the legacy sphere and eye fields and maps pearl to cloud', () => {
  expect(parseEvaLook({ sphere: 'pearl', eye: 'navy', motion: 'still' })).toEqual({
    ...DEFAULT_EVA_LOOK,
    ink: 'navy',
    motion: 'still',
  });
  expect(parseEvaLook({ sphere: 'graphite', eye: 'moonlight' }).body).toBe('graphite');
});

it('falls back per field and never selects a locked option', () => {
  expect(parseEvaLook({ body: 'rainbow', ink: 'cocoa', leaf: 'autumn', petal: 'sun' })).toEqual({
    ...DEFAULT_EVA_LOOK,
    ink: 'cocoa',
  });
});
