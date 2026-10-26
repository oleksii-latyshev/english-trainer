import { Layer } from 'effect';
import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { EvaGrowthService } from '../services/eva-growth-service';

export const runtime = Atom.runtime(EvaGrowthService.layer.pipe(Layer.provide(CoreLive)));

export const growthPreferenceRuntime = Atom.runtime(
  KeyValueStore.layerStorage(() => window.localStorage),
);
