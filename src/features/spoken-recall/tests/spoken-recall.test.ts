import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { captureStateAtom } from '@/core/answer-capture';
import { Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import {
  recallActiveAtom,
  recallPlanAtom,
  recallRecorderAtom,
  recallResultAtom,
  submitRecallAtom,
} from '../model/atoms';
import { leaveRecall, nextRecall, startRecall } from '../model/controls';
import { runtime } from '../model/runtime';
import { SpokenRecallService } from '../services/spoken-recall-service';
import type { DailyRecallPlan } from '../types';

Reflect.set(globalThis, 'isTauri', true);

const SESSION = 41;

type Backend = {
  plan: DailyRecallPlan;
  failing: Set<string>;
  calls: Array<{ command: string; args: unknown }>;
};

function aBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    plan: {
      completed_count: 0,
      items: [
        { phrase_id: 7, cue: 'A practical benefit' },
        { phrase_id: 8, cue: 'A usual habit' },
      ],
    },
    failing: new Set(),
    calls: [],
    ...overrides,
  };
}

function layerOf(backend: Backend) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        backend.calls.push({ command, args });
        if (backend.failing.has(command)) {
          return Effect.fail(new IpcError({ code: 'database_error', message: 'Try later.' }));
        }
        if (command === 'get_daily_recall_plan') return Effect.succeed(backend.plan);
        if (command === 'submit_daily_recall') {
          const [done, ...rest] = backend.plan.items;
          backend.plan = { completed_count: 1, items: rest };
          return Effect.succeed({
            phrase_id: done?.phrase_id,
            transcript: String(Reflect.get(args ?? {}, 'transcript')),
            target: 'It saves me time.',
            wording_observed: true,
          });
        }
        return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected' }));
      }),
  });
  return SpokenRecallService.layer.pipe(Layer.provide(ipc));
}

function opened(backend: Backend) {
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layerOf(backend)]] });
  registry.mount(recallPlanAtom(SESSION));
  registry.mount(recallActiveAtom);
  registry.mount(recallResultAtom);
  registry.mount(submitRecallAtom(SESSION));
  registry.mount(recallRecorderAtom);
  return registry;
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the recall never reached the expected state');
}

function planOf(registry: AtomRegistry.AtomRegistry): DailyRecallPlan | undefined {
  const plan = registry.get(recallPlanAtom(SESSION));
  return AsyncResult.isSuccess(plan) ? plan.value : undefined;
}

const SAID = {
  tag: 'transcript',
  text: 'It saves me time',
  durationMs: 1500,
  speechStoppedAtMs: 1400,
} as const;

describe('the due phrases of the session', () => {
  it('loads the plan for this session', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => planOf(registry) !== undefined);
    expect(planOf(registry)?.items).toHaveLength(2);
    expect(backend.calls[0]).toEqual({
      command: 'get_daily_recall_plan',
      args: { sessionId: SESSION },
    });
  });

  it('keeps a failed load for the Retry loading button', async () => {
    const backend = aBackend();
    backend.failing.add('get_daily_recall_plan');
    const registry = opened(backend);
    await until(() => AsyncResult.isFailure(registry.get(recallPlanAtom(SESSION))));
  });
});

describe('a spoken recall', () => {
  it('starts with a clean capture and leaves with one', () => {
    const registry = opened(aBackend());
    registry.set(captureStateAtom, SAID);
    startRecall(registry);
    expect(registry.get(recallActiveAtom)).toBe(true);
    expect(registry.get(captureStateAtom).tag).toBe('idle');
    registry.set(captureStateAtom, SAID);
    leaveRecall(registry);
    expect(registry.get(recallActiveAtom)).toBe(false);
    expect(registry.get(captureStateAtom).tag).toBe('idle');
  });

  it('offers the heard transcript to save', () => {
    const registry = opened(aBackend());
    registry.set(captureStateAtom, SAID);
    expect(registry.get(recallRecorderAtom).transcript).toBe('It saves me time');
  });

  it('saves the attempt, shows the result and moves on to the next phrase', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => planOf(registry) !== undefined);
    startRecall(registry);
    registry.set(captureStateAtom, SAID);
    registry.set(submitRecallAtom(SESSION), { phraseId: 7, transcript: 'It saves me time' });
    await until(() => registry.get(recallResultAtom) !== null);
    expect(registry.get(recallResultAtom)?.target).toBe('It saves me time.');
    expect(planOf(registry)?.items.map((item) => item.phrase_id)).toEqual([8]);
    expect(planOf(registry)?.completed_count).toBe(1);
    expect(registry.get(captureStateAtom).tag).toBe('idle');
    nextRecall(registry);
    expect(registry.get(recallResultAtom)).toBeNull();
    expect(backend.calls).toContainEqual({
      command: 'submit_daily_recall',
      args: { sessionId: SESSION, phraseId: 7, transcript: 'It saves me time' },
    });
  });

  it('keeps the transcript when saving fails', async () => {
    const backend = aBackend();
    backend.failing.add('submit_daily_recall');
    const registry = opened(backend);
    await until(() => planOf(registry) !== undefined);
    startRecall(registry);
    registry.set(captureStateAtom, SAID);
    registry.set(submitRecallAtom(SESSION), { phraseId: 7, transcript: 'It saves me time' });
    await until(() => AsyncResult.isFailure(registry.get(submitRecallAtom(SESSION))));
    expect(registry.get(recallResultAtom)).toBeNull();
    expect(registry.get(recallRecorderAtom).transcript).toBe('It saves me time');
  });
});
