import { Effect } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { learningMemoryRuntime } from '@/core/learning-memory';
import { SpeechRecognition } from '@/core/speech';
import { finishRun } from './finish';
import { keyboardAtom } from './keyboard';
import { materialsPreparationAtom, runIdAtom } from './materials-atoms';
import { narrationAtom } from './narration';
import { captureRuntime } from './runtime';
import { isRunFinishedAtom, openedReviewAtom, sessionAtom } from './session-atoms';

export const autoFinishAtom = learningMemoryRuntime.atom((get) => {
  if (!AsyncResult.isSuccess(get(openedReviewAtom))) return Effect.void;
  const session = get.once(sessionAtom);
  return session?.step.tag === 'closing' ? finishRun(get.registry) : Effect.void;
});

const warmSpeechAtom = captureRuntime.atom((get) => {
  const runId = get(runIdAtom);
  if (runId === null || get.once(isRunFinishedAtom)) return Effect.void;
  return Effect.gen(function* () {
    const recognition = yield* SpeechRecognition;
    yield* recognition.warm;
  }).pipe(Effect.ignore);
});

export const reviewEffectsAtom = Atom.make((get) => {
  get.mount(narrationAtom);
  get.mount(keyboardAtom);
  get.mount(materialsPreparationAtom);
  get.mount(autoFinishAtom);
  get.mount(warmSpeechAtom);
});
