import { expect, it } from 'bun:test';
import type { ModelRequests } from '@/core/ipc';
import { usageShare } from '.';

const MODELS: readonly ModelRequests[] = [
  { model: 'a', requests: 142 },
  { model: 'b', requests: 71 },
  { model: 'c', requests: 0 },
];

it('sizes each model against the busiest one', () => {
  expect(MODELS.map((entry) => usageShare(entry, MODELS))).toEqual([100, 50, 0]);
});

it('is empty when nothing was requested', () => {
  const idle = [{ model: 'a', requests: 0 }];
  expect(usageShare(idle[0] as ModelRequests, idle)).toBe(0);
});
