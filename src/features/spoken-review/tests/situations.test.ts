import { describe, expect, it } from 'bun:test';
import {
  materialsPreparationAtom,
  materialsStateAtom,
  retryMaterialsAtom,
  revealPhraseAtom,
} from '../model/materials-atoms';
import { makeBackend } from './fakes';
import { commands, opened, runFn, until } from './harness';

describe('situations', () => {
  it('prepares the situations once the run is open and keeps them for later reads', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    registry.mount(materialsPreparationAtom);
    await until(() => registry.get(materialsStateAtom).materials?.preparation.state === 'ready');
    expect(registry.get(materialsStateAtom).isBusy).toBe(false);
    expect(commands(backend)).toContain('prepare_review_material');
  });

  it('shows a preparation failure and can retry it', async () => {
    const backend = makeBackend();
    backend.failing.add('prepare_review_material');
    const registry = await opened(backend);
    registry.mount(materialsPreparationAtom);
    await until(() => registry.get(materialsStateAtom).error !== null);
    expect(registry.get(materialsStateAtom).error).toContain('could not be prepared');
    backend.failing.clear();
    await runFn(
      registry,
      retryMaterialsAtom,
      undefined,
      () => registry.get(materialsStateAtom).materials?.preparation.state === 'ready',
    );
    expect(registry.get(materialsStateAtom).error).toBeNull();
  });

  it('shows the phrase only after the reveal was saved', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    registry.mount(materialsPreparationAtom);
    await until(() => registry.get(materialsStateAtom).materials !== null);
    backend.failing.add('reveal_review_phrase');
    await runFn(
      registry,
      revealPhraseAtom,
      undefined,
      () => registry.get(materialsStateAtom).error !== null,
    );
    expect(registry.get(materialsStateAtom).materials?.items[0].is_cued).toBe(false);
    backend.failing.clear();
    await runFn(
      registry,
      revealPhraseAtom,
      undefined,
      () => registry.get(materialsStateAtom).materials?.items[0].is_cued === true,
    );
    expect(registry.get(materialsStateAtom).error).toBeNull();
  });
});
