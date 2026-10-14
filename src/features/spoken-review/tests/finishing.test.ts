import { describe, expect, it } from 'bun:test';
import { autoFinishAtom } from '../model/effects';
import { endReviewAtom, finishAtom } from '../model/review-actions';
import { summaryReachedAtom } from '../model/session-atoms';
import { aReviewItem, aReviewRun, makeBackend } from './fakes';
import { commands, opened, runFn, session, until } from './harness';

describe('finishing', () => {
  const resolved = aReviewRun(1, {
    items: [
      aReviewItem(1, {
        target: 'Target 1',
        transcript: 'said',
        wording_observed: true,
        saved_response: 'remembered',
        status: 'learning',
        interval_days: 2,
        next_review_at: 5,
      }),
    ],
  });

  it('closes an already resolved run when it is opened', async () => {
    const backend = makeBackend({ run: resolved });
    const registry = await opened(backend);
    expect(session(registry).step.tag).toBe('closing');
    registry.mount(autoFinishAtom);
    await until(() => session(registry).step.tag === 'summary');
    expect(commands(backend).filter((command) => command === 'finish_memory_review')).toHaveLength(
      1,
    );
  });

  it('waits for a retry when closing fails, without finishing twice on its own', async () => {
    const backend = makeBackend({ run: resolved });
    backend.failing.add('finish_memory_review');
    const registry = await opened(backend);
    registry.mount(autoFinishAtom);
    await until(() => session(registry).actionError === 'finish');
    expect(session(registry).step.tag).toBe('closing');
    expect(registry.get(summaryReachedAtom)).toBe(false);
    backend.failing.clear();
    await runFn(registry, finishAtom, undefined, () => session(registry).step.tag === 'summary');
    expect(registry.get(summaryReachedAtom)).toBe(true);
  });

  it('leaves through the callback only after the run is finished', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    let left = 0;
    await runFn(
      registry,
      endReviewAtom,
      () => (left += 1),
      () => left === 1,
    );
    expect(commands(backend)).toContain('finish_memory_review');
  });

  it('stays in the review when ending fails', async () => {
    const backend = makeBackend();
    backend.failing.add('finish_memory_review');
    const registry = await opened(backend);
    let left = 0;
    await runFn(
      registry,
      endReviewAtom,
      () => (left += 1),
      () => session(registry).actionError === 'finish',
    );
    expect(left).toBe(0);
    expect(session(registry).pending).toBe('none');
  });
});
