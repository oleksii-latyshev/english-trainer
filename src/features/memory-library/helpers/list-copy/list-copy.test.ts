import { expect, it } from 'bun:test';
import { emptyCopy } from './index';

it('explains an empty list and invites the first save', () => {
  expect(emptyCopy('').title).toBe('No phrases saved yet');
  expect(emptyCopy(' ').title).toBe('No phrases saved yet');
});

it('says nothing matches while a search is set', () => {
  expect(emptyCopy(' stale ').title).toBe('Nothing matches “stale”');
});
