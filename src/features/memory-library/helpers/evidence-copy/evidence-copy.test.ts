import { expect, it } from 'bun:test';
import { evidenceDate, evidenceSource, evidenceTag, evidenceTone } from './index';

it('tags a correct use as on your own and anything else as a slip', () => {
  expect(evidenceTag({ outcome: 'correct' })).toBe('On your own');
  expect(evidenceTone({ outcome: 'correct' })).toBe('own');
  expect(evidenceTag({ outcome: 'incorrect' })).toBe('Slipped back');
  expect(evidenceTone({ outcome: 'uncertain' })).toBe('slip');
});

it('names where the evidence came from', () => {
  expect(evidenceSource({ origin: 'feedback' })).toBe('From Eva’s note');
  expect(evidenceSource({ origin: 'assessment' })).toBe('From the usage review');
});

it('writes a short month and day', () => {
  expect(evidenceDate(new Date(2026, 9, 9, 12).getTime())).toBe('Oct 9');
});
