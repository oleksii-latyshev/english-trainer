import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import { SAMPLE_SENTENCE } from '../helpers/response-test-copy';
import { responseTestStreamAtom, runResponseTestAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { ResponseTestService } from '../services/response-test-service';

if (typeof window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true, writable: true });
}
Object.assign(window, {
  __TAURI_INTERNALS__: { transformCallback: () => 1, unregisterCallback: () => {} },
});

type Reply = { readonly deltas: readonly string[]; readonly answer: unknown };

function makeRegistry(reply: Reply | IpcError) {
  const calls: Array<{ readonly command: string; readonly args: unknown }> = [];
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        calls.push({ command, args });
        if (reply instanceof IpcError) return Effect.fail(reply);
        const channel = Reflect.get(args ?? {}, 'onReply') as {
          onmessage: (event: unknown) => void;
        };
        for (const text of reply.deltas) channel.onmessage({ kind: 'delta', text });
        return Effect.succeed(reply.answer);
      }),
  });
  const registry = AtomRegistry.make({
    initialValues: [[runtime.layer, ResponseTestService.layer.pipe(Layer.provide(ipc))]],
  });
  registry.mount(responseTestStreamAtom);
  return { registry, calls };
}

const TURN = {
  spoken_reply: 'Nice to meet you.',
  question: 'What do you do?',
  session_phase: 'warmup',
  is_complete: false,
  provider_latency_ms: 1400,
  first_token_ms: 620,
  answered_by: { provider: 'gemini', model: 'gemini-3.5-flash-lite', is_backup: false },
};

it('sends the sample sentence and returns the decoded reply', async () => {
  const { registry, calls } = makeRegistry({ deltas: [], answer: TURN });
  registry.set(runResponseTestAtom, undefined);
  const turn = await Effect.runPromise(AtomRegistry.getResult(registry, runResponseTestAtom));
  expect(turn).toEqual(TURN as typeof turn);
  expect(calls[0]?.command).toBe('generate_follow_up');
  expect(Reflect.get(calls[0]?.args ?? {}, 'transcript')).toBe(SAMPLE_SENTENCE);
});

it('collects the streamed words while the reply is generated', async () => {
  const { registry } = makeRegistry({ deltas: ['Nice ', 'to meet you.'], answer: TURN });
  registry.set(runResponseTestAtom, undefined);
  await Effect.runPromise(AtomRegistry.getResult(registry, runResponseTestAtom));
  expect(registry.get(responseTestStreamAtom)).toBe('Nice to meet you.');
});

it('starts each run with an empty stream', async () => {
  const { registry } = makeRegistry({ deltas: ['Hello'], answer: TURN });
  registry.set(responseTestStreamAtom, 'old words');
  registry.set(runResponseTestAtom, undefined);
  await Effect.runPromise(AtomRegistry.getResult(registry, runResponseTestAtom));
  expect(registry.get(responseTestStreamAtom)).toBe('Hello');
});

it('reports a provider failure by its code', async () => {
  const failure = new IpcError({ code: 'unauthorized', message: 'No Gemini API key is set.' });
  const { registry } = makeRegistry(failure);
  registry.set(runResponseTestAtom, undefined);
  await Effect.runPromiseExit(AtomRegistry.getResult(registry, runResponseTestAtom));
  const result = registry.get(runResponseTestAtom);
  expect(AsyncResult.isFailure(result)).toBe(true);
  expect(AsyncResult.isFailure(result) && JSON.stringify(result.cause)).toContain('unauthorized');
});

it('fails with IpcDecodeError when the reply does not match the contract', async () => {
  const { registry } = makeRegistry({ deltas: [], answer: { spoken_reply: 5 } });
  registry.set(runResponseTestAtom, undefined);
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, runResponseTestAtom).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcDecodeError);
});
