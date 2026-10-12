import { KeyValueStore } from 'effect/persistence';
import { Atom } from 'effect/reactivity';

export const conversationFlowRuntime = Atom.runtime(
  KeyValueStore.layerStorage(() => window.localStorage),
);
