import type { AtomRegistry } from 'effect/reactivity';
import type { RescueKind } from '@/core/ipc';
import type { RescueState, RescueTarget } from '../types';
import { rescueEntryAtom, rescueGenerationAtom, rescueStateAtom, rescueTargetAtom } from './atoms';
import { holdOpen, releaseHold } from './hold';
import { requestRescueAtom } from './request';

type Registry = AtomRegistry.AtomRegistry;

function show(registry: Registry, target: RescueTarget, state: RescueState) {
  registry.set(rescueEntryAtom, { key: target.key, state });
}

function supersede(registry: Registry): number {
  const generation = registry.get(rescueGenerationAtom) + 1;
  registry.set(rescueGenerationAtom, generation);
  return generation;
}

function begin(registry: Registry, kind: RescueKind, description: string) {
  const target = registry.get(rescueTargetAtom);
  if (target === null || registry.get(rescueStateAtom).tag === 'loading') return;
  const generation = supersede(registry);
  holdOpen(registry, target);
  show(registry, target, { tag: 'loading', kind, description });
  registry.set(requestRescueAtom, { target, kind, description, generation });
}

export function openRescue(registry: Registry) {
  if (registry.get(rescueStateAtom).tag !== 'closed') return;
  begin(registry, 'next_step', '');
}

export function closeRescue(registry: Registry) {
  supersede(registry);
  releaseHold(registry);
  const target = registry.get(rescueTargetAtom);
  if (target !== null) show(registry, target, { tag: 'closed' });
}

export function chooseRescueKind(registry: Registry, kind: RescueKind) {
  const target = registry.get(rescueTargetAtom);
  if (target === null || registry.get(rescueStateAtom).tag === 'loading') return;
  if (kind !== 'missing_word') {
    begin(registry, kind, '');
    return;
  }
  holdOpen(registry, target);
  show(registry, target, { tag: 'missing-word', description: '' });
}

export function describeMissingWord(registry: Registry, description: string) {
  const target = registry.get(rescueTargetAtom);
  if (target === null || registry.get(rescueStateAtom).tag !== 'missing-word') return;
  show(registry, target, { tag: 'missing-word', description });
}

export function findMissingWord(registry: Registry) {
  const state = registry.get(rescueStateAtom);
  if (state.tag !== 'missing-word' || state.description.trim() === '') return;
  begin(registry, 'missing_word', state.description.trim());
}

export function retryRescue(registry: Registry) {
  const state = registry.get(rescueStateAtom);
  if (state.tag !== 'error') return;
  begin(registry, state.kind, state.description);
}

export function selectRescueTerm(registry: Registry, term: string) {
  const target = registry.get(rescueTargetAtom);
  const state = registry.get(rescueStateAtom);
  if (target === null || state.tag !== 'answer' || state.kind !== 'missing_word') return;
  show(registry, target, { tag: 'selected', term });
}
