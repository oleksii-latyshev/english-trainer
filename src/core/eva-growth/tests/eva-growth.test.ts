import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { Ipc } from '@/core/ipc';
import { practiceStateAtom } from '@/core/practice-session';
import { aFinishedSession } from '@/core/practice-session/tests/builders';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import { evaGrowthAtom, evaNappingAtom, evaStageAtom, growthPreferenceAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { DEFAULT_GROWTH } from '../preferences';
import { EvaGrowthService } from '../services/eva-growth-service';

installFakeLocalStorage({});

function growth(overrides: Record<string, unknown> = {}) {
  return {
    drops: 45,
    stage: 2,
    stage_floor: 30,
    next_threshold: 60,
    napping: false,
    today: { speaking: [], sunshine: [] },
    ...overrides,
  };
}

function makeRegistry(answers: unknown[]) {
  let calls = 0;
  const ipc = Layer.succeed(Ipc, {
    invoke: () => Effect.sync(() => answers[Math.min(calls++, answers.length - 1)]),
  });
  const registry = AtomRegistry.make({
    initialValues: [[runtime.layer, EvaGrowthService.layer.pipe(Layer.provide(ipc))]],
  });
  registry.mount(evaGrowthAtom);
  registry.set(growthPreferenceAtom, DEFAULT_GROWTH);
  registry.mount(evaStageAtom);
  return { registry, calls: () => calls };
}

it('exposes the stage Rust reports', async () => {
  const { registry } = makeRegistry([growth()]);
  await Effect.runPromise(AtomRegistry.getResult(registry, evaGrowthAtom));
  expect(registry.get(evaStageAtom)).toBe(2);
});

it('hides the plant and the nap while growth is off but keeps reading it', async () => {
  const { registry } = makeRegistry([growth({ napping: true })]);
  await Effect.runPromise(AtomRegistry.getResult(registry, evaGrowthAtom));
  expect(registry.get(evaNappingAtom)).toBe(true);
  registry.set(growthPreferenceAtom, { showGrowth: false });
  expect(registry.get(evaStageAtom)).toBeNull();
  expect(registry.get(evaNappingAtom)).toBe(false);
});

it('reads growth again when a session completes', async () => {
  const { registry, calls } = makeRegistry([growth(), growth({ drops: 60, stage: 3 })]);
  await Effect.runPromise(AtomRegistry.getResult(registry, evaGrowthAtom));
  registry.set(practiceStateAtom, { tag: 'completed', summary: aFinishedSession() });
  await Effect.runPromise(AtomRegistry.getResult(registry, evaGrowthAtom));
  expect(calls()).toBe(2);
  expect(registry.get(evaStageAtom)).toBe(3);
});
