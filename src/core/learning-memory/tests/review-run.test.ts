import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError } from '@/core/ipc';
import { activeReviewRunAtom } from '../model/atoms';
import { runtime } from '../model/runtime';
import { ReviewRunService } from '../services/review-run-service';
import type { ReviewRun } from '../types';

const RUN: ReviewRun = {
  run_id: 71,
  completed: false,
  items: [
    {
      position: 1,
      item_type: 'phrase',
      item_id: 51,
      cue: 'Agree on a solution.',
      target: null,
      transcript: null,
      wording_observed: null,
      saved_response: null,
      next_review_at: null,
      interval_days: null,
      status: null,
      is_skipped: false,
    },
  ],
};

type Call = { command: string; args: unknown };

function makeFakes(answer: (command: string) => unknown) {
  const calls: Call[] = [];
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend(() => {
        calls.push({ command, args });
        return Effect.succeed(answer(command));
      }),
  });
  const layer = ReviewRunService.layer.pipe(
    Layer.provide(ipc),
    Layer.provideMerge(Reactivity.layer),
  );
  return { calls, layer };
}

function use<A, E>(
  layer: ReturnType<typeof makeFakes>['layer'],
  body: Effect.Effect<A, E, ReviewRunService>,
) {
  return Effect.runPromise(body.pipe(Effect.provide(layer)));
}

describe('review run service', () => {
  it('starts a warm-up with the warmup flag and decodes the run', async () => {
    const { calls, layer } = makeFakes(() => RUN);
    const run = await use(
      layer,
      ReviewRunService.use((service) => service.start(true)),
    );
    expect(run?.items[0].cue).toBe('Agree on a solution.');
    expect(calls).toEqual([{ command: 'start_memory_review', args: { warmup: true } }]);
  });

  it('knows there is nothing to start when Rust returns no run', async () => {
    const { layer } = makeFakes(() => null);
    expect(
      await use(
        layer,
        ReviewRunService.use((service) => service.start(false)),
      ),
    ).toBeNull();
  });

  it('sends an answer with the run, the item and the transcript', async () => {
    const result = {
      run_id: 71,
      position: 1,
      item_type: 'phrase',
      item_id: 51,
      cue: 'Agree on a solution.',
      target: 'find a compromise',
      transcript: 'We can find a compromise.',
      wording_observed: true,
      saved_response: 'remembered',
      next_review_at: 5,
      interval_days: 2,
      status: 'improving',
    };
    const { calls, layer } = makeFakes(() => result);
    await use(
      layer,
      ReviewRunService.use((service) =>
        service.submit({
          runId: 71,
          itemType: 'phrase',
          itemId: 51,
          transcript: 'We can find a compromise.',
        }),
      ),
    );
    expect(calls[0]).toEqual({
      command: 'submit_memory_recall',
      args: {
        run_id: 71,
        item_type: 'phrase',
        item_id: 51,
        transcript: 'We can find a compromise.',
      },
    });
  });

  it('finishes a run without expecting a value', async () => {
    const { calls, layer } = makeFakes(() => null);
    await use(
      layer,
      ReviewRunService.use((service) => service.finish(71)),
    );
    expect(calls).toEqual([{ command: 'finish_memory_review', args: { run_id: 71 } }]);
  });

  it('fails with a decode error when the preparation state is unknown', async () => {
    const { layer } = makeFakes(() => ({ run_id: 71, preparation: { state: 'later' }, items: [] }));
    const failure = await use(
      layer,
      ReviewRunService.use((service) => service.materials(71)).pipe(Effect.flip),
    );
    expect(failure).toBeInstanceOf(IpcDecodeError);
  });
});

describe('active review run', () => {
  it('reads the run that was started and not finished', async () => {
    const { layer } = makeFakes(() => RUN);
    const registry = AtomRegistry.make({ initialValues: [[runtime.layer, layer]] });
    const run = await Effect.runPromise(AtomRegistry.getResult(registry, activeReviewRunAtom));
    expect(run?.run_id).toBe(71);
  });
});
