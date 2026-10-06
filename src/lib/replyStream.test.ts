// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { expect, it } from 'bun:test';
import { isReplyStreamEvent } from './replyStream';

it('accepts delta events and rejects other shapes', () => {
  expect(isReplyStreamEvent({ kind: 'delta', text: 'Hello' })).toBe(true);
  expect(isReplyStreamEvent({ kind: 'delta' })).toBe(false);
  expect(isReplyStreamEvent({ kind: 'done', text: 'x' })).toBe(false);
  expect(isReplyStreamEvent(null)).toBe(false);
});
