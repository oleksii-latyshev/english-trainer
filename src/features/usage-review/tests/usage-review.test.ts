import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import { reviewUsageAtom, savedUsageAtom, usageKey, usageReviewViewAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { UsageReviewService } from '../services/usage-review-service';
import type { TurnUsageAssessment } from '../types';

Reflect.set(globalThis, 'isTauri', true);

const TARGET = usageKey({ sessionId: 7, sequence: 1 });

function anAssessment(overrides: Partial<TurnUsageAssessment> = {}): TurnUsageAssessment {
  return {
    session_id: 7,
    sequence: 1,
    assessed_at: 1,
    findings: [
      {
        item_type: 'phrase',
        item_id: 3,
        target: 'It saves me time.',
        outcome: 'correct',
        confidence: 0.95,
        exact_excerpt: 'it saves me time',
        credited: true,
        status_after: 'improving',
      },
    ],
    ...overrides,
  };
}

type Backend = {
  saved: TurnUsageAssessment | null;
  reviewed: TurnUsageAssessment;
  failing: Set<string>;
  calls: Array<{ command: string; args: unknown }>;
};

function aBackend(overrides: Partial<Backend> = {}): Backend {
  return { saved: null, reviewed: anAssessment(), failing: new Set(), calls: [], ...overrides };
}

function layerOf(backend: Backend) {
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend((): Effect.Effect<unknown, IpcError | IpcDecodeError> => {
        backend.calls.push({ command, args });
        if (backend.failing.has(command)) {
          return Effect.fail(new IpcError({ code: 'unavailable', message: 'Try later.' }));
        }
        if (command === 'get_practice_memory_usage') return Effect.succeed(backend.saved);
        if (command === 'review_practice_memory_usage') return Effect.succeed(backend.reviewed);
        return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected' }));
      }),
  });
  return UsageReviewService.layer.pipe(Layer.provide(ipc), Layer.provideMerge(Reactivity.layer));
}

function opened(backend: Backend) {
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layerOf(backend)]] });
  registry.mount(usageReviewViewAtom(TARGET));
  registry.mount(reviewUsageAtom(TARGET));
  return registry;
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the usage review never reached the expected state');
}

function tagOf(registry: AtomRegistry.AtomRegistry): string {
  return registry.get(usageReviewViewAtom(TARGET)).tag;
}

describe('the learning use review of an answer', () => {
  it('restores an earlier saved result', async () => {
    const registry = opened(aBackend({ saved: anAssessment() }));
    await until(() => tagOf(registry) === 'success');
  });

  it('offers to check an answer that was not reviewed yet', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => tagOf(registry) === 'idle');
    expect(backend.calls[0]).toEqual({
      command: 'get_practice_memory_usage',
      args: { session_id: 7, sequence: 1 },
    });
  });

  it('checks the answer and shows what was found', async () => {
    const backend = aBackend();
    const registry = opened(backend);
    await until(() => tagOf(registry) === 'idle');
    registry.set(reviewUsageAtom(TARGET), undefined);
    await until(() => tagOf(registry) === 'success');
    const view = registry.get(usageReviewViewAtom(TARGET));
    expect(view.tag === 'success' && view.assessment.findings[0]?.target).toBe('It saves me time.');
    expect(backend.calls[backend.calls.length - 1]?.command).toBe('review_practice_memory_usage');
  });

  it('can be checked again after a failed review', async () => {
    const backend = aBackend();
    backend.failing.add('review_practice_memory_usage');
    const registry = opened(backend);
    await until(() => tagOf(registry) === 'idle');
    registry.set(reviewUsageAtom(TARGET), undefined);
    await until(() => tagOf(registry) === 'review-error');
    backend.failing.clear();
    registry.set(reviewUsageAtom(TARGET), undefined);
    await until(() => tagOf(registry) === 'success');
  });

  it('says so when the saved result cannot be restored', async () => {
    const backend = aBackend();
    backend.failing.add('get_practice_memory_usage');
    const registry = opened(backend);
    await until(() => tagOf(registry) === 'restore-error');
    backend.failing.clear();
    registry.refresh(savedUsageAtom(TARGET));
    await until(() => tagOf(registry) === 'idle');
  });

  it('rejects a result that belongs to another answer', async () => {
    const registry = opened(aBackend({ reviewed: anAssessment({ sequence: 2 }) }));
    await until(() => tagOf(registry) === 'idle');
    registry.set(reviewUsageAtom(TARGET), undefined);
    await until(() => tagOf(registry) === 'review-error');
  });
});
