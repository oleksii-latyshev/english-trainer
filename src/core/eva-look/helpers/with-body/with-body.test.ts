import { expect, it } from 'bun:test';
import { DEFAULT_EVA_LOOK } from '../../palette';
import { withBody } from '.';

it('picks the ink that reads on the chosen body', () => {
  expect(withBody(DEFAULT_EVA_LOOK, 'graphite')).toEqual({
    ...DEFAULT_EVA_LOOK,
    body: 'graphite',
    ink: 'moonlight',
  });
  expect(withBody({ ...DEFAULT_EVA_LOOK, ink: 'plum' }, 'mint').ink).toBe('ink');
});
