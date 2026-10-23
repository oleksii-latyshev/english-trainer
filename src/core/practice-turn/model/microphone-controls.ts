import { Effect } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import { WarmMicrophone } from '@/core/audio';
import { interruptReply } from './interrupt';
import { turnRuntime } from './runtime';

const pauseAtom = Atom.keepAlive(
  turnRuntime.fn(
    Effect.fn('pauseMicrophone')(function* (_: undefined) {
      const warm = yield* WarmMicrophone;
      yield* warm.pause;
    }),
  ),
);

const resumeAtom = Atom.keepAlive(
  turnRuntime.fn(
    Effect.fn('resumeMicrophone')(function* (_: undefined) {
      const warm = yield* WarmMicrophone;
      yield* warm.resume;
    }),
  ),
);

export function pauseMicrophone(registry: AtomRegistry.AtomRegistry) {
  interruptReply(registry, { record: false, retainPreRoll: false });
  registry.set(pauseAtom, undefined);
}

export function resumeMicrophone(registry: AtomRegistry.AtomRegistry) {
  registry.set(resumeAtom, undefined);
}
