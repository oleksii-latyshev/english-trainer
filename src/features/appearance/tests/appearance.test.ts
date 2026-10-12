import { expect, it } from 'bun:test';
import { AtomRegistry } from 'effect/reactivity';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';

const stored = installFakeLocalStorage({
  english_trainer_appearance: JSON.stringify({ theme: 'light' }),
});

it('reads the theme saved by an earlier version', async () => {
  const { appearanceAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  expect(registry.get(appearanceAtom)).toEqual({ theme: 'light' });
});

it('persists a chosen theme in the stored shape', async () => {
  const { appearanceAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  registry.set(appearanceAtom, { theme: 'dark' });
  expect(registry.get(appearanceAtom).theme).toBe('dark');
  expect(JSON.parse(stored.get('english_trainer_appearance') ?? '{}')).toEqual({ theme: 'dark' });
});

it('falls back to the system theme when the stored value is unusable', async () => {
  stored.set('english_trainer_appearance', '{"theme":"sepia"}');
  const { appearanceAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  expect(registry.get(appearanceAtom)).toEqual({ theme: 'system' });
});
