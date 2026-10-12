import { expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { type ApiUsageOverview, Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import { apiUsageAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { ApiUsageService } from '../services/api-usage-service';

const USAGE: ApiUsageOverview = {
  day: '2026-10-09',
  gemini: {
    models: [{ model: 'gemini-3.5-flash-lite', requests: 142 }],
    last_limit: null,
    resets_at_ms: 1_800_000_000_000,
  },
  antigravity: { requests_today: 18, last_quota_error: null },
};

function makeRegistry(answer: unknown) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command) => {
      if (command !== 'get_api_usage') {
        return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
      }
      return answer instanceof IpcError ? Effect.fail(answer) : Effect.succeed(answer);
    },
  });
  return AtomRegistry.make({
    initialValues: [[runtime.layer, ApiUsageService.layer.pipe(Layer.provide(ipc))]],
  });
}

it('reads the counts and remembers when they were read', async () => {
  const registry = makeRegistry(USAGE);
  const before = Date.now();
  const snapshot = await Effect.runPromise(AtomRegistry.getResult(registry, apiUsageAtom));
  expect(snapshot.usage).toEqual(USAGE);
  expect(snapshot.loadedAtMs).toBeGreaterThanOrEqual(before);
});

it('fails with IpcDecodeError when a count is negative', async () => {
  const bad = { ...USAGE, antigravity: { requests_today: -1, last_quota_error: null } };
  const registry = makeRegistry(bad);
  const failure = await Effect.runPromise(
    AtomRegistry.getResult(registry, apiUsageAtom).pipe(Effect.flip),
  );
  expect(failure).toBeInstanceOf(IpcDecodeError);
});

it('reports a storage failure by its code', async () => {
  const registry = makeRegistry(new IpcError({ code: 'database_error', message: 'Retry.' }));
  registry.mount(apiUsageAtom);
  await Effect.runPromiseExit(AtomRegistry.getResult(registry, apiUsageAtom));
  const result = registry.get(apiUsageAtom);
  expect(AsyncResult.isFailure(result)).toBe(true);
  expect(AsyncResult.isFailure(result) && JSON.stringify(result.cause)).toContain('database_error');
});
