import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcError } from '@/core/ipc';
import { learningMemoryRuntime, ReviewRunService } from '@/core/learning-memory';
import { activeReviewAtom } from '../model/atoms';

function item(position: number, isSkipped: boolean, response: 'remembered' | null) {
  return {
    position,
    item_type: 'phrase',
    item_id: 50 + position,
    cue: `Cue ${position}`,
    target: response ? `Target ${position}` : null,
    transcript: response ? 'said it' : null,
    wording_observed: response ? true : null,
    saved_response: response,
    next_review_at: response ? 5 : null,
    interval_days: response ? 2 : null,
    status: response ? 'learning' : null,
    is_skipped: isSkipped,
  };
}

function registryFor(answer: () => unknown) {
  const ipc = Layer.succeed(Ipc, {
    invoke: () => {
      const value = answer();
      return value instanceof IpcError ? Effect.fail(value) : Effect.succeed(value);
    },
  });
  const layer = ReviewRunService.layer.pipe(
    Layer.provide(ipc),
    Layer.provideMerge(Reactivity.layer),
  );
  const registry = AtomRegistry.make({ initialValues: [[learningMemoryRuntime.layer, layer]] });
  registry.mount(activeReviewAtom);
  return registry;
}

async function settled(registry: AtomRegistry.AtomRegistry) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const value = registry.get(activeReviewAtom);
    if (value.tag === 'saved') return value;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return registry.get(activeReviewAtom);
}

describe('the saved review shown on Memory', () => {
  it('counts the items that are answered or skipped', async () => {
    const run = {
      run_id: 3,
      completed: false,
      items: [item(1, false, 'remembered'), item(2, true, null), item(3, false, null)],
    };
    const value = await settled(registryFor(() => run));
    expect(value).toEqual({ tag: 'saved', resolved: 2, total: 3 });
  });

  it('offers a new review when none was started', async () => {
    const value = await settled(registryFor(() => null));
    expect(value).toEqual({ tag: 'none' });
  });

  it('offers a new review when the saved run cannot be read', async () => {
    const failure = new IpcError({ code: 'database_error', message: 'Try again.' });
    const value = await settled(registryFor(() => failure));
    expect(value).toEqual({ tag: 'none' });
  });
});
