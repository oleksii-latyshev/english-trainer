import { Layer } from 'effect';
import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { DockIconService } from '../services/dock-icon-service';

const StorageLive = KeyValueStore.layerStorage(() => window.localStorage);

export const runtime = Atom.runtime(
  Layer.mergeAll(DockIconService.layer.pipe(Layer.provide(CoreLive)), StorageLive),
);
