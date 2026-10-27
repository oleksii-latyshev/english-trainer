import { type AsyncResult, type Atom, AtomRegistry } from 'effect/reactivity';
import { type LearningItemRef, learningMemoryRuntime } from '@/core/learning-memory';
import { beginReview } from '../model/begin-review';
import { materialsStateAtom } from '../model/materials-atoms';
import { captureRuntime } from '../model/runtime';
import { reviewViewAtom, sessionAtom, statusBeforeAtom } from '../model/session-atoms';
import { issueAtom } from '../model/view-atoms';
import type { ReviewMode } from '../types';
import { type Backend, captureLayer, learningLayer, type Microphone } from './fakes';

const SILENT_MICROPHONE: Microphone = {
  clip: () => {
    throw new Error('the flow tests never record');
  },
  transcript: () => {
    throw new Error('the flow tests never transcribe');
  },
  liveTexts: [],
};

function openReview(
  backend: Backend,
  mode: ReviewMode = 'review',
  target: LearningItemRef | null = null,
) {
  const registry = AtomRegistry.make({
    initialValues: [
      [learningMemoryRuntime.layer, learningLayer(backend)],
      [captureRuntime.layer, captureLayer(SILENT_MICROPHONE)],
    ],
  });
  beginReview(registry, mode, target);
  registry.mount(reviewViewAtom);
  registry.mount(sessionAtom);
  registry.mount(materialsStateAtom);
  registry.mount(statusBeforeAtom);
  registry.mount(issueAtom);
  return registry;
}

export async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the review never reached the expected state');
}

export async function opened(
  backend: Backend,
  mode: ReviewMode = 'review',
  target: LearningItemRef | null = null,
) {
  const registry = openReview(backend, mode, target);
  await until(() => registry.get(reviewViewAtom).tag !== 'loading');
  return registry;
}

export function commands(backend: Backend): string[] {
  return backend.calls.map((call) => call.command);
}

export function session(registry: AtomRegistry.AtomRegistry) {
  const current = registry.get(sessionAtom);
  if (current === null) throw new Error('the review has no session');
  return current;
}

export async function runFn<Arg, A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Writable<AsyncResult.AsyncResult<A, E>, Arg>,
  arg: Arg,
  settled: () => boolean,
) {
  registry.mount(atom);
  registry.set(atom, arg);
  await until(settled);
}
