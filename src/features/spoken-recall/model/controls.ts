import type { AtomRegistry } from 'effect/reactivity';
import { resetCapture, stopListening, transcribeAgain } from '@/core/answer-capture';
import { interruptReply } from '@/core/practice-turn';
import { recallActiveAtom, recallResultAtom } from './atoms';

export function startRecall(registry: AtomRegistry.AtomRegistry) {
  resetCapture(registry);
  registry.set(recallResultAtom, null);
  registry.set(recallActiveAtom, true);
}

export function leaveRecall(registry: AtomRegistry.AtomRegistry) {
  resetCapture(registry);
  registry.set(recallActiveAtom, false);
  registry.set(recallResultAtom, null);
}

export function nextRecall(registry: AtomRegistry.AtomRegistry) {
  registry.set(recallResultAtom, null);
}

export function startRecallRecording(registry: AtomRegistry.AtomRegistry) {
  interruptReply(registry, { record: true, retainPreRoll: false });
}

export function stopRecallRecording(registry: AtomRegistry.AtomRegistry) {
  stopListening(registry);
}

export function retryRecallTranscription(registry: AtomRegistry.AtomRegistry) {
  transcribeAgain(registry);
}
