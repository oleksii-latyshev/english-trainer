import { expect, it } from 'bun:test';
import { litBars } from './lit-bars';

it('lights none for silence or no reading', () => {
  expect(litBars(undefined, 12)).toBe(0);
  expect(litBars(0, 12)).toBe(0);
  expect(litBars(Number.NaN, 12)).toBe(0);
});

it('scales the level to the bar count and caps it', () => {
  expect(litBars(0.5, 12)).toBe(6);
  expect(litBars(1, 12)).toBe(12);
  expect(litBars(3, 12)).toBe(12);
});
