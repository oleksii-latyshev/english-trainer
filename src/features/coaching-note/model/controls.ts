import type { AtomRegistry } from 'effect/reactivity';
import {
  resetCapture,
  startListening,
  stopListening,
  transcribeAgain,
} from '@/core/answer-capture';
import type { AnswerTarget } from '../types';
import { compareFailureAtom, sayAgainTargetAtom } from './atoms';

export function startSayAgain(registry: AtomRegistry.AtomRegistry, target: AnswerTarget) {
  registry.set(compareFailureAtom, null);
  registry.set(sayAgainTargetAtom, target);
  resetCapture(registry);
  startListening(registry, { mode: 'manual', discardPreRoll: false });
}

export function stopSayAgain(registry: AtomRegistry.AtomRegistry) {
  stopListening(registry);
}

export function retryTranscription(registry: AtomRegistry.AtomRegistry) {
  transcribeAgain(registry);
}

export function cancelSayAgain(registry: AtomRegistry.AtomRegistry) {
  registry.set(sayAgainTargetAtom, null);
  registry.set(compareFailureAtom, null);
  resetCapture(registry);
}
