import { expect, it } from 'bun:test';
import { pathLabel, statusLabel } from '.';

it('labels each component status for the learner', () => {
  expect(statusLabel('available')).toBe('Found');
  expect(statusLabel('missing')).toBe('Missing');
  expect(statusLabel('unreadable')).toBe('Cannot read');
});

it('says so when a path is not known', () => {
  expect(pathLabel(null)).toBe('Path not found');
  expect(pathLabel('/opt/homebrew/bin/whisper-cli')).toBe('/opt/homebrew/bin/whisper-cli');
});
