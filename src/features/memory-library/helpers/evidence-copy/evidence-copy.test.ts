import { expect, it } from 'bun:test';
import { evidenceDate, evidenceSource, evidenceTag, evidenceTone, isShownEvidence } from './index';

it('tags a correct use as on your own, a helped use as with help and a relapse as a slip', () => {
  expect(evidenceTag({ outcome: 'correct' })).toBe('On your own');
  expect(evidenceTone({ outcome: 'correct' })).toBe('own');
  expect(evidenceTag({ outcome: 'with_help' })).toBe('With help');
  expect(evidenceTone({ outcome: 'with_help' })).toBe('quiet');
  expect(evidenceTag({ outcome: 'incorrect' })).toBe('Slipped back');
  expect(evidenceTone({ outcome: 'incorrect' })).toBe('quiet');
});

it('hides uncertain evidence because it reads as a failure without proof', () => {
  expect(isShownEvidence({ outcome: 'uncertain' })).toBe(false);
  expect(isShownEvidence({ outcome: 'with_help' })).toBe(true);
  expect(isShownEvidence({ outcome: 'correct' })).toBe(true);
  expect(isShownEvidence({ outcome: 'incorrect' })).toBe(true);
});

it('names where the evidence came from', () => {
  expect(evidenceSource({ origin: 'feedback' })).toBe('From Eva’s note');
  expect(evidenceSource({ origin: 'assessment' })).toBe('From the usage review');
});

it('writes a short month and day', () => {
  expect(evidenceDate(new Date(2026, 9, 9, 12).getTime())).toBe('Oct 9');
});
