import { expect, it } from 'bun:test';
import { Effect, Layer, Queue, Stream } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError, IpcEvents } from '@/core/ipc';
import {
  dueMistakeCountAtom,
  mistakeDetailAtom,
  mistakeGroupsAtom,
  mistakesUpdatesAtom,
  ruleCardAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { MistakesService } from '../services/mistakes-service';

const GROUPS = {
  groups: [
    {
      rule_key: 'articles',
      title: 'Articles',
      summary: 'A, an and the.',
      mistake_count: 2,
      fixed_count: 1,
      due_count: 1,
      relapse_count: 0,
      last_relapse_at: null,
      mistakes: [],
    },
  ],
  ungrouped: [],
  due_count: 4,
};

function detail(lessonState: 'pending' | 'ready') {
  return {
    id: 7,
    question: 'Where do you work?',
    said: 'I work in office.',
    corrected: 'I work in an office.',
    review_explanation: 'Use an article.',
    session_id: 1,
    sequence: 1,
    last_seen_at: 1,
    ladder_step: 1,
    fixed_at: null,
    next_review_at: 1,
    is_due: true,
    rule: { rule_key: 'articles', title: 'Articles' },
    lesson_state: lessonState,
    lesson: null,
  };
}

type Call = { command: string; args: unknown };

function makeRegistry(answer: (command: string, calls: Call[]) => unknown) {
  const calls: Call[] = [];
  const events = Effect.runSync(Queue.unbounded<{ lessons_ready: number }>());
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend(() => {
        calls.push({ command, args });
        const result = answer(command, calls);
        return result instanceof IpcError ? Effect.fail(result) : Effect.succeed(result);
      }),
  });
  const eventLayer = Layer.succeed(IpcEvents, {
    listen: <A>() => Stream.fromQueue(events) as unknown as Stream.Stream<A>,
    listenAll: () => Stream.empty,
  });
  const registry = AtomRegistry.make({
    initialValues: [
      [
        runtime.layer,
        MistakesService.layer.pipe(
          Layer.provide(Layer.merge(ipc, eventLayer)),
          Layer.provideMerge(Reactivity.layer),
        ),
      ],
    ],
  });
  return { registry, calls, events };
}

async function waitFor(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200 && !check(); attempt += 1) await Bun.sleep(2);
}

it('reads the groups and exposes the due count', async () => {
  const { registry, calls } = makeRegistry(() => GROUPS);
  registry.mount(dueMistakeCountAtom);
  await Effect.runPromise(AtomRegistry.getResult(registry, mistakeGroupsAtom));
  expect(calls.map((call) => call.command)).toEqual(['list_mistake_groups']);
  expect(registry.get(dueMistakeCountAtom)).toBe(4);
});

it('fails with IpcDecodeError when a lesson state is unknown', async () => {
  const { registry } = makeRegistry(() => ({ ...detail('ready'), lesson_state: 'done' }));
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, mistakeDetailAtom(7)).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcDecodeError);
});

it('asks for a rule card by its key', async () => {
  const { registry, calls } = makeRegistry(() => ({
    rule_key: 'articles',
    title: 'Articles',
    summary: 'A, an and the.',
    body: null,
    examples: [],
  }));
  await Effect.runPromise(AtomRegistry.getResult(registry, ruleCardAtom('articles')));
  expect(calls[0]).toEqual({ command: 'get_rule_card', args: { ruleKey: 'articles' } });
});

it('reloads an open mistake when the lesson becomes ready', async () => {
  let isReady = false;
  const { registry, calls, events } = makeRegistry((command) =>
    command === 'get_mistake' ? detail(isReady ? 'ready' : 'pending') : GROUPS,
  );
  registry.mount(mistakesUpdatesAtom);
  registry.mount(mistakeDetailAtom(7));
  const first = await Effect.runPromise(AtomRegistry.getResult(registry, mistakeDetailAtom(7)));
  expect(first.lesson_state).toBe('pending');

  isReady = true;
  await Effect.runPromise(Queue.offer(events, { lessons_ready: 1 }));
  await waitFor(() => calls.filter((call) => call.command === 'get_mistake').length > 1);

  const reloaded = await Effect.runPromise(AtomRegistry.getResult(registry, mistakeDetailAtom(7)));
  expect(reloaded.lesson_state).toBe('ready');
});
