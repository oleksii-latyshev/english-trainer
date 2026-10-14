import { describe, expect, it } from 'bun:test';
import { submitTranscriptAtom } from '../model/answer-atoms';
import { nextAtom, skipAtom } from '../model/review-actions';
import { summaryReachedAtom } from '../model/session-atoms';
import { issueAtom } from '../model/view-atoms';
import { aReviewRun, makeBackend } from './fakes';
import { commands, opened, runFn, session } from './harness';

describe('moving on', () => {
  it('goes to the next item after a result and finishes after the last one', async () => {
    const backend = makeBackend({ run: aReviewRun(1) });
    const registry = await opened(backend);
    await runFn(
      registry,
      submitTranscriptAtom,
      'one',
      () => session(registry).step.tag === 'result',
    );
    await runFn(registry, nextAtom, undefined, () => session(registry).step.tag === 'summary');
    expect(commands(backend)).toContain('finish_memory_review');
    expect(registry.get(summaryReachedAtom)).toBe(true);
  });

  it('skips the current item and keeps the run open for the next one', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    await runFn(registry, skipAtom, undefined, () => session(registry).run.items[0].is_skipped);
    expect(session(registry).step.tag).toBe('answering');
    expect(commands(backend)).not.toContain('finish_memory_review');
  });

  it('finishes after the last item is skipped', async () => {
    const backend = makeBackend({ run: aReviewRun(1) });
    const registry = await opened(backend);
    await runFn(registry, skipAtom, undefined, () => session(registry).step.tag === 'summary');
    expect(commands(backend)).toContain('finish_memory_review');
  });

  it('reports a failed skip and lets the learner try again', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    backend.failing.add('skip_memory_review_item');
    await runFn(registry, skipAtom, undefined, () => session(registry).actionError === 'skip');
    expect(registry.get(issueAtom)?.fix).toBe('skip-again');
    backend.failing.clear();
    await runFn(registry, skipAtom, undefined, () => session(registry).run.items[0].is_skipped);
  });
});
