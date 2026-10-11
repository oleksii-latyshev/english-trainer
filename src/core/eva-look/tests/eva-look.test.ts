import { expect, it } from 'bun:test';
import { AtomRegistry } from 'effect/reactivity';
import { evaLookAtom } from '../model/atoms';
import { DEFAULT_EVA_LOOK } from '../palette';

it('starts from the default look when nothing is stored', () => {
  const registry = AtomRegistry.make();
  expect(registry.get(evaLookAtom)).toEqual(DEFAULT_EVA_LOOK);
});

it('keeps the chosen look until it is changed again', () => {
  const registry = AtomRegistry.make();
  registry.set(evaLookAtom, { ...DEFAULT_EVA_LOOK, body: 'mint' });
  expect(registry.get(evaLookAtom).body).toBe('mint');
});
