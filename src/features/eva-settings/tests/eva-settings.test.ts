import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { KeyValueStore } from 'effect/persistence';
import { AtomRegistry } from 'effect/reactivity';
import { DEFAULT_EVA_LOOK, evaLookAtom } from '@/core/eva-look';
import { Ipc, IpcDecodeError } from '@/core/ipc';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import {
  dockIconAtom,
  dockIconSyncAtom,
  growthAtom,
  pickPreviewStageAtom,
  previewMoodAtom,
  previewStageAtom,
  resetEvaSettingsAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { DockIconService } from '../services/dock-icon-service';

const stored = installFakeLocalStorage({
  english_trainer_dock_icon: JSON.stringify({ icon: 'dark' }),
});

function makeRegistry(options: { failDock?: boolean } = {}) {
  const dockCalls: unknown[] = [];
  const FakeIpc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend(() => {
        dockCalls.push(args);
        return options.failDock
          ? Effect.fail(new IpcDecodeError({ command, cause: 'rejected' }))
          : Effect.succeed(null);
      }),
  });
  const layer = Layer.mergeAll(
    DockIconService.layer.pipe(Layer.provide(FakeIpc)),
    KeyValueStore.layerStorage(() => window.localStorage),
  );
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layer]] });
  return { registry, dockCalls };
}

it('applies the saved Dock icon and applies again when it changes', async () => {
  const { registry, dockCalls } = makeRegistry();
  registry.mount(dockIconSyncAtom);
  await Effect.runPromise(AtomRegistry.getResult(registry, dockIconSyncAtom));
  expect(dockCalls).toEqual([{ icon: 'dark' }]);
  registry.set(dockIconAtom, { icon: 'light' });
  await Effect.runPromise(
    AtomRegistry.getResult(registry, dockIconSyncAtom, { suspendOnWaiting: true }),
  );
  expect(dockCalls).toEqual([{ icon: 'dark' }, { icon: 'light' }]);
  expect(JSON.parse(stored.get('english_trainer_dock_icon') ?? '{}')).toEqual({ icon: 'light' });
});

it('keeps the choice when the Dock icon cannot be changed', async () => {
  const { registry } = makeRegistry({ failDock: true });
  registry.mount(dockIconSyncAtom);
  const result = await Effect.runPromiseExit(AtomRegistry.getResult(registry, dockIconSyncAtom));
  expect(result._tag).toBe('Success');
  expect(registry.get(dockIconAtom).icon).toBe('light');
});

it('picking a growth stage shows growth and previews that stage', () => {
  const { registry } = makeRegistry();
  registry.set(growthAtom, { showGrowth: false });
  registry.set(pickPreviewStageAtom, 5);
  expect(registry.get(previewStageAtom)).toBe(5);
  expect(registry.get(growthAtom)).toEqual({ showGrowth: true });
});

it('reset restores the look, growth, Dock icon and preview together', () => {
  const { registry } = makeRegistry();
  registry.set(evaLookAtom, { ...DEFAULT_EVA_LOOK, body: 'mint' });
  registry.set(growthAtom, { showGrowth: false });
  registry.set(previewMoodAtom, 'asleep');
  registry.set(resetEvaSettingsAtom, undefined);
  expect(registry.get(evaLookAtom)).toEqual(DEFAULT_EVA_LOOK);
  expect(registry.get(growthAtom)).toEqual({ showGrowth: true });
  expect(registry.get(dockIconAtom)).toEqual({ icon: 'eva' });
  expect(registry.get(previewMoodAtom)).toBe('happy');
  expect(registry.get(previewStageAtom)).toBe(4);
});
