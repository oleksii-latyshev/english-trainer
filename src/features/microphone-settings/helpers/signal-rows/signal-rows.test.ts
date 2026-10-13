import { expect, it } from 'bun:test';
import { decibelLabel, processingLabel, secondsLabel, windowRangeLabel } from '.';

it('reports a browser setting only when it was reported', () => {
  expect(processingLabel(undefined)).toBe('Not reported');
  expect(processingLabel(true)).toBe('On');
  expect(processingLabel(false)).toBe('Off');
});

it('shows levels in decibels and silence as Silent', () => {
  expect(decibelLabel(0.1)).toBe('-20 dB');
  expect(decibelLabel(0)).toBe('Silent');
});

it('labels a window by its start and end second', () => {
  expect(windowRangeLabel({ offsetMs: 2000, durationMs: 1000, rms: 0.1, peak: 0.2 })).toBe(
    '2–3.0s',
  );
});

it('formats a duration in seconds', () => {
  expect(secondsLabel(4250)).toBe('4.3s');
});
