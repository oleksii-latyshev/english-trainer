import { expect, it } from 'bun:test';
import { AtomRegistry } from 'effect/reactivity';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';

const stored = installFakeLocalStorage({});

it('is pending until the learner finishes or skips', async () => {
  const { firstRunMarkerAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  expect(registry.get(firstRunMarkerAtom)).toEqual({ status: 'pending' });
});

it('records a skip in the shape earlier versions stored', async () => {
  const { firstRunMarkerAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  registry.set(firstRunMarkerAtom, { status: 'skipped' });
  expect(JSON.parse(stored.get('english_trainer_first_run') ?? '{}')).toEqual({
    status: 'skipped',
  });
});

it('reads a marker saved by an earlier version', async () => {
  stored.set('english_trainer_first_run', JSON.stringify({ status: 'finished' }));
  const { firstRunMarkerAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  expect(registry.get(firstRunMarkerAtom)).toEqual({ status: 'finished' });
});
