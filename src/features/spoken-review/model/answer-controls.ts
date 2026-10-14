import { Atom, type AtomRegistry } from 'effect/reactivity';
import { stopClipAtom } from '@/core/audio';
import { createPlayback } from '@/core/speech';
import { answerAtom } from './answer-atoms';
import {
  captureOutcomeAtom,
  frozenPromptAtom,
  IDLE_OUTCOME,
  lastTranscriptAtom,
  liveTextAtom,
} from './capture-state';
import { sessionAtom } from './session-atoms';

export function stopSpeech(registry: AtomRegistry.AtomRegistry) {
  createPlayback(registry).stop();
}

export function startAnswer(registry: AtomRegistry.AtomRegistry) {
  registry.set(answerAtom, undefined);
}

export function finishAnswer(registry: AtomRegistry.AtomRegistry) {
  registry.set(stopClipAtom, undefined);
}

export function cancelAnswer(registry: AtomRegistry.AtomRegistry) {
  if (registry.get(captureOutcomeAtom).tag !== 'transcribing') {
    registry.set(answerAtom, Atom.Interrupt);
  }
  registry.set(captureOutcomeAtom, IDLE_OUTCOME);
  registry.set(liveTextAtom, '');
}

export function resetAnswer(registry: AtomRegistry.AtomRegistry) {
  cancelAnswer(registry);
  registry.set(lastTranscriptAtom, null);
  const session = registry.get(sessionAtom);
  if (session !== null && session.actionError !== null) {
    registry.set(sessionAtom, { ...session, actionError: null });
  }
}

export function forgetFrozenPrompt(registry: AtomRegistry.AtomRegistry) {
  registry.set(frozenPromptAtom, null);
}
