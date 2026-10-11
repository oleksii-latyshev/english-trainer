import { expect, it } from 'bun:test';
import { keySourceLabel } from '.';

it('names where the key comes from', () => {
  expect(keySourceLabel('settings')).toBe('Saved, encrypted on this Mac');
  expect(keySourceLabel('environment')).toBe(
    'Using the ENG_TRAINER_GEMINI_API_KEY environment variable',
  );
});
