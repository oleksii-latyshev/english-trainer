import { Effect, Option } from 'effect';
import { AsyncResult, Atom, AtomRegistry } from 'effect/reactivity';
import { ipcFailureMessage } from '@/core/ipc';
import {
  type InputKind,
  MISTAKES,
  MistakesService,
  mistakesRuntime,
  type RunTarget,
} from '@/core/mistakes';
import { toast } from '@/shared/ui/toast';
import { isSummary } from '../helpers/run-position';

const START_FAILED = 'Could not start the practice. Please try again.';
const ANSWER_FAILED = 'Could not save your answer. Please try again.';
const CHECK_FAILED = 'Could not start the check. Please try again.';
const RETRY_FAILED = 'Could not retry the check. Please try again.';

export const runAtom = Atom.family((runId: number) =>
  mistakesRuntime
    .atom(Effect.flatMap(MistakesService, (service) => service.run(runId)))
    .pipe(Atom.runtime.withReactivity(MISTAKES)),
);

export const cursorAtom = Atom.family((_runId: number) => Atom.make<number | null>(null));

export const draftAtom = Atom.family((_key: string) => Atom.make<readonly string[]>([]));

export const retryOpenAtom = Atom.family((_key: string) => Atom.make(false));

export const heardAtom = Atom.family((_key: string) => Atom.make(''));

function reloadRun(registry: AtomRegistry.AtomRegistry, runId: number) {
  registry.refresh(runAtom(runId));
  return AtomRegistry.getResult(registry, runAtom(runId), { suspendOnWaiting: true });
}

type Failure = Parameters<typeof ipcFailureMessage>[0];

function toastFailure(fallback: string) {
  return <A, R>(effect: Effect.Effect<A, Failure, R>) =>
    effect.pipe(
      Effect.tapError((failure) =>
        Effect.sync(() => toast.danger(ipcFailureMessage(failure, fallback))),
      ),
    );
}

type StartInput = { readonly target: RunTarget; readonly onStarted: (runId: number) => void };

export const startMistakeRunAtom = mistakesRuntime.fn(
  Effect.fn('startMistakeRun')(function* (input: StartInput) {
    const service = yield* MistakesService;
    const run = yield* service.startRun(input.target).pipe(toastFailure(START_FAILED));
    input.onStarted(run.run_id);
  }),
  { reactivityKeys: MISTAKES },
);

export type Answer = {
  readonly runId: number;
  readonly position: number;
  readonly answer: string;
  readonly input: InputKind;
};

export const saveAnswer = Effect.fn('saveMistakeAnswer')(function* (
  registry: AtomRegistry.AtomRegistry,
  answer: Answer,
) {
  const service = yield* MistakesService;
  registry.set(cursorAtom(answer.runId), answer.position);
  yield* service
    .answer(answer.runId, answer.position, answer.answer, answer.input)
    .pipe(toastFailure(ANSWER_FAILED));
  yield* reloadRun(registry, answer.runId);
});

export const submitAnswerAtom = mistakesRuntime.fn(
  Effect.fn('submitMistakeAnswer')(function* (answer: Answer, get: Atom.FnContext) {
    yield* saveAnswer(get.registry, answer);
  }),
  { reactivityKeys: MISTAKES },
);

type Position = { readonly runId: number; readonly position: number };

export const checkAnswerAtom = mistakesRuntime.fn(
  Effect.fn('checkMistakeAnswer')(function* (target: Position, get: Atom.FnContext) {
    const service = yield* MistakesService;
    get.set(cursorAtom(target.runId), target.position);
    yield* service.check(target.runId, target.position).pipe(toastFailure(CHECK_FAILED));
    yield* reloadRun(get.registry, target.runId);
  }),
  { reactivityKeys: MISTAKES },
);

type RetryCheck = { readonly runId: number; readonly attemptId: number };

export const retryCheckAtom = mistakesRuntime.fn(
  Effect.fn('retryMistakeCheck')(function* (target: RetryCheck, get: Atom.FnContext) {
    const service = yield* MistakesService;
    yield* service.retryCheck(target.attemptId).pipe(toastFailure(RETRY_FAILED));
    yield* reloadRun(get.registry, target.runId);
  }),
  { reactivityKeys: MISTAKES },
);

const finishRequestedAtom = Atom.family((_runId: number) => Atom.keepAlive(Atom.make(false)));

export const finishEffectAtom = Atom.family((runId: number) =>
  mistakesRuntime.atom((get) => {
    const run = Option.getOrNull(AsyncResult.value(get(runAtom(runId))));
    const isRequested = get.registry.get(finishRequestedAtom(runId));
    if (isRequested || run === null || run.finished) return Effect.void;
    if (!isSummary(run, get(cursorAtom(runId)))) return Effect.void;
    return Effect.gen(function* () {
      get.registry.set(finishRequestedAtom(runId), true);
      const service = yield* MistakesService;
      yield* service.finish(runId);
      get.registry.refresh(runAtom(runId));
    }).pipe(Effect.ignore);
  }),
);
