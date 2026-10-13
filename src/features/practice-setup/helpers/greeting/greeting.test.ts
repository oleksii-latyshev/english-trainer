import { expect, it } from 'bun:test';
import { greeting } from './index';

it('greets by the time of day', () => {
  expect(greeting(0)).toBe('Good morning');
  expect(greeting(11)).toBe('Good morning');
  expect(greeting(12)).toBe('Good afternoon');
  expect(greeting(17)).toBe('Good afternoon');
  expect(greeting(18)).toBe('Good evening');
  expect(greeting(23)).toBe('Good evening');
});
