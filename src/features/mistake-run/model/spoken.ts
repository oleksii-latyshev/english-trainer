import { Effect } from 'effect';
import { Atom, type AtomRegistry } from 'effect/reactivity';
import {
  captureStateAtom,
  resetCapture,
  startListening,
  stopListening,
  transcribeAgain,
} from '@/core/answer-capture';
import { mistakesRuntime } from '@/core/mistakes';
import { exerciseKey } from '../helpers/exercise-key';
import type { SpokenTarget, SpokenView } from '../types';
import { cursorAtom, heardAtom, saveAnswer } from './atoms';

const spokenTargetAtom = Atom.keepAlive(Atom.make<SpokenTarget | null>(null));

const transcriptAtom = Atom.make((get): string => {
  const capture = get(captureStateAtom);
  return capture.tag === 'transcript' ? capture.text.trim() : '';
});

const captureProblemAtom = Atom.make((get): string => {
  const capture = get(captureStateAtom);
  if (capture.tag === 'error') return capture.failure?.message ?? capture.message;
  if (capture.tag === 'ready') return capture.failure?.message ?? '';
  return '';
});

export function startSpoken(registry: AtomRegistry.AtomRegistry, target: SpokenTarget) {
  registry.set(spokenTargetAtom, target);
  registry.set(cursorAtom(target.runId), target.position);
  resetCapture(registry);
  startListening(registry, { mode: 'manual', discardPreRoll: false });
}

export function stopSpoken(registry: AtomRegistry.AtomRegistry) {
  stopListening(registry);
}

export function retrySpokenTranscription(registry: AtomRegistry.AtomRegistry) {
  transcribeAgain(registry);
}

export function cancelSpoken(registry: AtomRegistry.AtomRegistry) {
  registry.set(spokenTargetAtom, null);
  resetCapture(registry);
}

export const spokenEffectsAtom = mistakesRuntime.atom((get) => {
  const target = get(spokenTargetAtom);
  const transcript = get(transcriptAtom);
  if (target === null || transcript === '') return Effect.void;
  return Effect.gen(function* () {
    get.registry.set(heardAtom(exerciseKey(target.runId, target.position)), transcript);
    yield* saveAnswer(get.registry, {
      runId: target.runId,
      position: target.position,
      answer: transcript,
      input: 'spoken',
    });
  }).pipe(Effect.ignore, Effect.ensuring(Effect.sync(() => cancelSpoken(get.registry))));
});

export const spokenGuardAtom = Atom.make((get) => {
  get.addFinalizer(() => cancelSpoken(get.registry));
  return null;
});

export const spokenViewAtom = Atom.family((key: string) =>
  Atom.make((get): SpokenView => {
    const target = get(spokenTargetAtom);
    if (target === null) return { tag: 'idle' };
    if (exerciseKey(target.runId, target.position) !== key) return { tag: 'busy' };
    const capture = get(captureStateAtom);
    switch (capture.tag) {
      case 'idle':
        return { tag: 'idle' };
      case 'requesting':
        return { tag: 'requesting' };
      case 'recording':
      case 'stopping':
        return { tag: 'recording', liveText: capture.liveText };
      case 'transcribing':
        return { tag: 'transcribing' };
      case 'transcript':
        return { tag: 'saving' };
      case 'ready':
        return { tag: 'failed', message: get(captureProblemAtom), canRetryTranscription: true };
      case 'error':
        return { tag: 'failed', message: get(captureProblemAtom), canRetryTranscription: false };
    }
  }),
);
