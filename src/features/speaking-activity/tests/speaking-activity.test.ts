import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import { speakingActivityAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { SpeakingActivityService } from '../services/speaking-activity-service';

function makeRegistry(answer: unknown) {
  const calls: string[] = [];
  const ipc = Layer.succeed(Ipc, {
    invoke: (command) => {
      calls.push(command);
      if (command !== 'get_speaking_activity') {
        return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
      }
      return answer instanceof IpcError ? Effect.fail(answer) : Effect.succeed(answer);
    },
  });
  const registry = AtomRegistry.make({
    initialValues: [[runtime.layer, SpeakingActivityService.layer.pipe(Layer.provide(ipc))]],
  });
  return { registry, calls };
}

it('reads the minutes spoken per day from Rust', async () => {
  const days = [
    { date: '2026-10-09', minutes: 9 },
    { date: '2026-10-10', minutes: 12 },
  ];
  const { registry, calls } = makeRegistry({ days });
  const activity = await Effect.runPromise(AtomRegistry.getResult(registry, speakingActivityAtom));
  expect(activity.days).toEqual(days);
  expect(calls).toEqual(['get_speaking_activity']);
});

it('accepts a learner who has not spoken yet', async () => {
  const { registry } = makeRegistry({ days: [] });
  const activity = await Effect.runPromise(AtomRegistry.getResult(registry, speakingActivityAtom));
  expect(activity.days).toEqual([]);
});

it('fails with IpcDecodeError when a day has no minutes', async () => {
  const { registry } = makeRegistry({ days: [{ date: '2026-10-10', minutes: 0 }] });
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, speakingActivityAtom).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcDecodeError);
});

it('reports a storage failure by its code', async () => {
  const error = new IpcError({ code: 'database_error', message: 'Could not read it.' });
  const { registry } = makeRegistry(error);
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, speakingActivityAtom).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcError);
  expect(failure instanceof IpcError && failure.code).toBe('database_error');
});
