import { expect, it } from 'bun:test';
import { AtomRegistry } from 'effect/reactivity';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import { DEFAULT_EVA_LOOK } from '../palette';

const stored = installFakeLocalStorage({
  english_trainer_eva_look: JSON.stringify({ sphere: 'pearl', eye: 'plum', motion: 'gentle' }),
});

it('reads a legacy stored look and maps it onto the current palette', async () => {
  const { evaLookAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  expect(registry.get(evaLookAtom)).toEqual({
    ...DEFAULT_EVA_LOOK,
    ink: 'plum',
    motion: 'gentle',
  });
});

it('persists a chosen look', async () => {
  const { evaLookAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  registry.set(evaLookAtom, { ...DEFAULT_EVA_LOOK, body: 'mint' });
  expect(registry.get(evaLookAtom).body).toBe('mint');
  expect(JSON.parse(stored.get('english_trainer_eva_look') ?? '{}').body).toBe('mint');
});
