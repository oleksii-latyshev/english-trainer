import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import {
  evidenceKey,
  learningMemoryAtom,
  memoryUsageEvidenceAtom,
  openedLearningMemoryAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { LearningMemoryService } from '../services/learning-memory-service';

const EMPTY_VIEW = { mistakes: [], phrase_cards: [], due_count: 0 };

type Call = { command: string; args: unknown };

function makeRegistry(answer: (command: string) => unknown) {
  const calls: Call[] = [];
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend(() => {
        calls.push({ command, args });
        const result = answer(command);
        return result instanceof IpcError ? Effect.fail(result) : Effect.succeed(result);
      }),
  });
  const registry = AtomRegistry.make({
    initialValues: [
      [
        runtime.layer,
        LearningMemoryService.layer.pipe(Layer.provide(ipc), Layer.provideMerge(Reactivity.layer)),
      ],
    ],
  });
  return { registry, calls };
}

it('reads the library without marking the cues as shown', async () => {
  const { registry, calls } = makeRegistry(() => EMPTY_VIEW);
  await Effect.runPromise(AtomRegistry.getResult(registry, learningMemoryAtom));
  expect(calls.map((call) => call.command)).toEqual(['get_learning_memory']);
});

it('opening Memory uses the command that marks the cues as shown', async () => {
  const { registry, calls } = makeRegistry(() => EMPTY_VIEW);
  await Effect.runPromise(AtomRegistry.getResult(registry, openedLearningMemoryAtom));
  expect(calls.map((call) => call.command)).toEqual(['view_learning_memory']);
});

it('fails with IpcDecodeError when a status is unknown', async () => {
  const unknownStatus = {
    ...EMPTY_VIEW,
    mistakes: [{ id: 1, status: 'mastered' }],
  };
  const { registry } = makeRegistry(() => unknownStatus);
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, learningMemoryAtom).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcDecodeError);
});

it('reports a storage failure by its code', async () => {
  const error = new IpcError({ code: 'database_error', message: 'Could not read it.' });
  const { registry } = makeRegistry(() => error);
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, learningMemoryAtom).pipe(Effect.flip),
  );
  expect(failure instanceof IpcError && failure.code).toBe('database_error');
});

it('reads the evidence of one item', async () => {
  const evidence = {
    item_type: 'mistake',
    item_id: 4,
    distinct_session_count: 1,
    streak: 1,
    events: [],
  };
  const { registry, calls } = makeRegistry(() => evidence);
  const result = await Effect.runPromise(
    AtomRegistry.getResult(
      registry,
      memoryUsageEvidenceAtom(evidenceKey({ itemType: 'mistake', itemId: 4 })),
    ),
  );
  expect(result.streak).toBe(1);
  expect(calls[0]).toEqual({
    command: 'get_memory_usage_evidence',
    args: { item_type: 'mistake', item_id: 4 },
  });
});
