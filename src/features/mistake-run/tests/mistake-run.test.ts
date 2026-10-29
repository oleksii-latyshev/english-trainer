import { expect, it } from 'bun:test';
import { Effect, Layer, Stream } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcEvents } from '@/core/ipc';
import { MistakesService, mistakesRuntime } from '@/core/mistakes';
import {
  cursorAtom,
  finishEffectAtom,
  retryCheckAtom,
  runAtom,
  submitAnswerAtom,
} from '../model/atoms';

type Call = { command: string; args: unknown };

function exercise(position: number, answered: boolean) {
  return {
    position,
    mistake_id: position + 1,
    step: 3,
    rule_key: 'articles',
    question: 'Where do you work?',
    said: null,
    sentence: null,
    result: answered
      ? {
          attempt_id: 20 + position,
          outcome: 'miss',
          note: 'Not quite — here is the version to keep.',
          keep: 'I work in an office.',
          lesson: 'Use an article.',
          can_check: false,
          retried: false,
          retry_note: null,
          check_failed: false,
        }
      : null,
  };
}

function run(answered: readonly boolean[], finished = false) {
  return {
    run_id: 9,
    kind: 'due',
    finished,
    items: answered.map((isAnswered, index) => exercise(index, isAnswered)),
  };
}

function makeRegistry(initial: readonly boolean[]) {
  const calls: Call[] = [];
  let answered = [...initial];
  let finished = false;
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.sync(() => {
        calls.push({ command, args });
        if (command === 'answer_mistake_step') {
          const position = Number((args as { position: number }).position);
          answered = answered.map((value, index) => value || index === position);
          return exercise(position, true);
        }
        if (command === 'finish_mistake_run') {
          finished = true;
          return run(answered, true);
        }
        if (command === 'retry_mistake_check') return null;
        return run(answered, finished);
      }),
  });
  const events = Layer.succeed(IpcEvents, {
    listen: <A>() => Stream.empty as unknown as Stream.Stream<A>,
    listenAll: () => Stream.empty,
  });
  const registry = AtomRegistry.make({
    initialValues: [
      [
        mistakesRuntime.layer,
        MistakesService.layer.pipe(
          Layer.provide(Layer.merge(ipc, events)),
          Layer.provideMerge(Reactivity.layer),
        ),
      ],
    ],
  });
  return { registry, calls };
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !check(); attempt += 1) await Bun.sleep(2);
}

it('sends a typed answer for its position and reloads the run with the result', async () => {
  const { registry, calls } = makeRegistry([false, false]);
  registry.mount(runAtom(9));
  registry.mount(submitAnswerAtom);
  registry.mount(cursorAtom(9));
  await Effect.runPromise(AtomRegistry.getResult(registry, runAtom(9)));

  registry.set(submitAnswerAtom, { runId: 9, position: 0, answer: 'have been', input: 'typed' });
  await waitFor(() => calls.filter((call) => call.command === 'get_mistake_run').length > 1);

  expect(calls.find((call) => call.command === 'answer_mistake_step')?.args).toEqual({
    runId: 9,
    position: 0,
    answer: 'have been',
    input: 'typed',
  });
  expect(registry.get(cursorAtom(9))).toBe(0);
  const reloaded = await Effect.runPromise(AtomRegistry.getResult(registry, runAtom(9)));
  expect(reloaded.items[0]?.result?.outcome).toBe('miss');
});

it('finishes an unfinished run once the learner is past the last exercise', async () => {
  const { registry, calls } = makeRegistry([true, true]);
  registry.mount(runAtom(9));
  registry.mount(finishEffectAtom(9));
  await waitFor(() => calls.some((call) => call.command === 'finish_mistake_run'));

  expect(calls.filter((call) => call.command === 'finish_mistake_run')).toEqual([
    { command: 'finish_mistake_run', args: { runId: 9 } },
  ]);
  await waitFor(() => calls.filter((call) => call.command === 'get_mistake_run').length > 1);
  const finished = await Effect.runPromise(AtomRegistry.getResult(registry, runAtom(9)));
  expect(finished.finished).toBe(true);
});

it('keeps an open run open while the learner is still on an exercise', async () => {
  const { registry, calls } = makeRegistry([true, false]);
  registry.mount(runAtom(9));
  registry.mount(finishEffectAtom(9));
  await Effect.runPromise(AtomRegistry.getResult(registry, runAtom(9)));
  await Bun.sleep(20);

  expect(calls.some((call) => call.command === 'finish_mistake_run')).toBe(false);
});

it('retries a failed check by its attempt and reloads the run', async () => {
  const { registry, calls } = makeRegistry([true]);
  registry.mount(runAtom(9));
  registry.mount(retryCheckAtom);
  await Effect.runPromise(AtomRegistry.getResult(registry, runAtom(9)));

  registry.set(retryCheckAtom, { runId: 9, attemptId: 20 });
  await waitFor(() => calls.filter((call) => call.command === 'get_mistake_run').length > 1);

  expect(calls.find((call) => call.command === 'retry_mistake_check')?.args).toEqual({
    attemptId: 20,
  });
});
