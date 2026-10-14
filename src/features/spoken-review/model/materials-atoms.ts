import { Effect, Exit } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import {
  learningMemoryRuntime,
  type ReviewMaterials,
  ReviewRunService,
} from '@/core/learning-memory';
import { mergeReviewMaterials } from '../helpers/materials-merge';
import { sessionAtom, shownItemAtom } from './session-atoms';

export type MaterialsState = {
  readonly materials: ReviewMaterials | null;
  readonly error: string | null;
  readonly isBusy: boolean;
};

const EMPTY_MATERIALS: MaterialsState = { materials: null, error: null, isBusy: false };

export const PREPARE_FAILED_MESSAGE =
  'Review situations could not be prepared. You can answer now or try again.';
export const REFRESH_FAILED_MESSAGE =
  'Review materials could not be refreshed. Your saved items are unchanged; you can retry.';
export const REVEAL_FAILED_MESSAGE = 'Could not show the phrase. Please try again.';

export const runIdAtom = Atom.make((get) => get(sessionAtom)?.run.run_id ?? null);

export const materialsStateAtom = Atom.writable(
  (get): MaterialsState => {
    get(runIdAtom);
    return EMPTY_MATERIALS;
  },
  (context, next: MaterialsState) => context.setSelf(next),
);

export const shownMaterialAtom = Atom.make((get) => {
  const item = get(shownItemAtom);
  const materials = get(materialsStateAtom).materials;
  if (item === null || materials === null) return null;
  return materials.items.find((entry) => entry.position === item.position) ?? null;
});

function update(
  registry: AtomRegistry.AtomRegistry,
  runId: number,
  change: Partial<MaterialsState>,
) {
  if (registry.get(runIdAtom) !== runId) return;
  registry.set(materialsStateAtom, { ...registry.get(materialsStateAtom), ...change });
}

function accept(
  registry: AtomRegistry.AtomRegistry,
  runId: number,
  incoming: ReviewMaterials,
  shouldClearError = true,
) {
  if (registry.get(runIdAtom) !== runId) return;
  const state = registry.get(materialsStateAtom);
  update(registry, runId, {
    materials: mergeReviewMaterials(state.materials, incoming),
    error: shouldClearError ? null : state.error,
  });
}

function refreshEffect(
  registry: AtomRegistry.AtomRegistry,
  runId: number,
  shouldClearError: boolean,
) {
  return Effect.gen(function* () {
    const service = yield* ReviewRunService;
    const exit = yield* Effect.exit(service.materials(runId));
    if (Exit.isSuccess(exit)) accept(registry, runId, exit.value, shouldClearError);
    else update(registry, runId, { error: REFRESH_FAILED_MESSAGE });
  });
}

function markPending(registry: AtomRegistry.AtomRegistry, runId: number) {
  const { materials } = registry.get(materialsStateAtom);
  if (materials === null) return;
  update(registry, runId, { materials: { ...materials, preparation: { state: 'pending' } } });
}

export function prepareEffect(
  registry: AtomRegistry.AtomRegistry,
  runId: number,
  isRetry: boolean,
) {
  return Effect.gen(function* () {
    const service = yield* ReviewRunService;
    if (isRetry) markPending(registry, runId);
    update(registry, runId, { isBusy: true, error: null });
    const exit = yield* Effect.exit(service.prepareMaterials(runId, isRetry));
    if (Exit.isSuccess(exit)) accept(registry, runId, exit.value);
    else {
      update(registry, runId, { error: PREPARE_FAILED_MESSAGE });
      yield* refreshEffect(registry, runId, false);
    }
  }).pipe(Effect.ensuring(Effect.sync(() => update(registry, runId, { isBusy: false }))));
}

export const materialsPreparationAtom = learningMemoryRuntime.atom((get) => {
  const runId = get(runIdAtom);
  return runId === null ? Effect.void : prepareEffect(get.registry, runId, false);
});

export const retryMaterialsAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('retryMaterials')(function* (_: undefined, get: Atom.FnContext) {
      const runId = get.registry.get(runIdAtom);
      if (runId !== null) yield* prepareEffect(get.registry, runId, true);
    }),
  ),
);

export const refreshMaterialsAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('refreshMaterials')(function* (_: undefined, get: Atom.FnContext) {
      const runId = get.registry.get(runIdAtom);
      if (runId !== null) yield* refreshEffect(get.registry, runId, true);
    }),
  ),
);

export const revealPhraseAtom = Atom.keepAlive(
  learningMemoryRuntime.fn(
    Effect.fn('revealPhrase')(function* (_: undefined, get: Atom.FnContext) {
      const runId = get.registry.get(runIdAtom);
      const item = get.registry.get(shownItemAtom);
      if (runId === null || item === null) return;
      const service = yield* ReviewRunService;
      update(get.registry, runId, { error: null });
      const exit = yield* Effect.exit(service.revealPhrase(runId, item.position));
      if (Exit.isSuccess(exit)) accept(get.registry, runId, exit.value);
      else update(get.registry, runId, { error: REVEAL_FAILED_MESSAGE });
    }),
  ),
);
