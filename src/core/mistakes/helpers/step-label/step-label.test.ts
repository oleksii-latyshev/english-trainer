import { expect, it } from 'bun:test';
import { stepLabel } from './index';

it('names the four exercises and keeps odd steps in range', () => {
  expect(stepLabel(1)).toBe('Fill the gaps');
  expect(stepLabel(4)).toBe('Use it');
  expect(stepLabel(0)).toBe('Fill the gaps');
  expect(stepLabel(9)).toBe('Use it');
});
