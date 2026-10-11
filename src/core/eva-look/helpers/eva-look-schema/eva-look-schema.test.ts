import { expect, it } from 'bun:test';
import { DEFAULT_EVA_LOOK, type EvaLook } from '../../palette';
import { decodeEvaLook } from '.';

it('falls back to the default look for anything that is not a record', () => {
  expect(decodeEvaLook(undefined)).toEqual(DEFAULT_EVA_LOOK);
  expect(decodeEvaLook('mint')).toEqual(DEFAULT_EVA_LOOK);
  expect(decodeEvaLook([])).toEqual(DEFAULT_EVA_LOOK);
});

it('keeps a stored look written in the new shape', () => {
  const stored: EvaLook = {
    body: 'mint',
    ink: 'plum',
    leaf: 'sky',
    petal: 'lilac',
    motion: 'gentle',
  };
  expect(decodeEvaLook(stored)).toEqual(stored);
});

it('reads the legacy sphere and eye fields and maps pearl to cloud', () => {
  expect(decodeEvaLook({ sphere: 'pearl', eye: 'navy', motion: 'still' })).toEqual({
    ...DEFAULT_EVA_LOOK,
    ink: 'navy',
    motion: 'still',
  });
  expect(decodeEvaLook({ sphere: 'graphite', eye: 'moonlight' }).body).toBe('graphite');
});

it('falls back per field and never selects a locked option', () => {
  expect(decodeEvaLook({ body: 'rainbow', ink: 'cocoa', leaf: 'autumn', petal: 'sun' })).toEqual({
    ...DEFAULT_EVA_LOOK,
    ink: 'cocoa',
  });
});
