import { Atom, type AtomRegistry } from 'effect/reactivity';
import { cancelListening } from '@/core/answer-capture';
import { microphoneActivityAtom } from './activity';
import {
  autoListenAtom,
  echoCancellationAtom,
  microphoneDeviceAtom,
  prewarmAtom,
  releaseMicrophoneAtom,
  stageResetAtom,
  warmMicrophoneAtom,
} from './effects';
import { planningAtom, turnLockAtom } from './state';

export const practiceTurnEffectsAtom = Atom.make((get) => {
  get.mount(warmMicrophoneAtom);
  get.mount(releaseMicrophoneAtom);
  get.mount(echoCancellationAtom);
  get.mount(microphoneDeviceAtom);
  get.mount(stageResetAtom);
  get.mount(prewarmAtom);
  get.mount(autoListenAtom);
  get.mount(microphoneActivityAtom);
});

export function setPlanning(registry: AtomRegistry.AtomRegistry, isPlanning: boolean) {
  registry.set(planningAtom, isPlanning);
  if (isPlanning) cancelListening(registry);
}

export function lockTurn(registry: AtomRegistry.AtomRegistry, isLocked: boolean) {
  registry.set(turnLockAtom, isLocked);
}
