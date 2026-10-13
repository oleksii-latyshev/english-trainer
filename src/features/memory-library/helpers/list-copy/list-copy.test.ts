import { expect, it } from 'bun:test';
import { emptyCopy, isMemoryTab } from './index';

it('explains an empty tab and invites the first save', () => {
  expect(emptyCopy('phrases', '').title).toBe('No phrases saved yet');
  expect(emptyCopy('mistakes', ' ').title).toBe('No mistakes yet');
});

it('says nothing matches while a search is set', () => {
  expect(emptyCopy('phrases', ' stale ').title).toBe('Nothing matches “stale”');
});

it('recognises the two tabs only', () => {
  expect(isMemoryTab('phrases')).toBe(true);
  expect(isMemoryTab('mistakes')).toBe(true);
  expect(isMemoryTab('archived')).toBe(false);
});
