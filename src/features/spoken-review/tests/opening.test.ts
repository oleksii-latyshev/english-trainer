import { describe, expect, it } from 'bun:test';
import { reviewViewAtom, statusBeforeAtom } from '../model/session-atoms';
import { makeBackend } from './fakes';
import { commands, opened, session } from './harness';

describe('opening the review', () => {
  it('shows the first item of a started run', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    expect(registry.get(reviewViewAtom)).toEqual({ tag: 'ready' });
    expect(session(registry).step).toEqual({ tag: 'answering' });
    expect(commands(backend)).toContain('start_memory_review');
    expect(backend.calls.find((call) => call.command === 'start_memory_review')?.args).toEqual({
      warmup: false,
    });
  });

  it('starts the three-phrase warm-up when asked to warm up', async () => {
    const backend = makeBackend();
    await opened(backend, 'warmup');
    expect(backend.calls.find((call) => call.command === 'start_memory_review')?.args).toEqual({
      warmup: true,
    });
  });

  it('says there is nothing to review when no run starts', async () => {
    const registry = await opened(makeBackend({ run: null }));
    expect(registry.get(reviewViewAtom)).toEqual({ tag: 'nothing' });
  });

  it('fails the opening when the run cannot start', async () => {
    const backend = makeBackend();
    backend.failing.add('start_memory_review');
    const registry = await opened(backend);
    expect(registry.get(reviewViewAtom)).toEqual({ tag: 'error' });
  });

  it('works without the status chip when the library cannot be read', async () => {
    const backend = makeBackend();
    backend.failing.add('get_learning_memory');
    const registry = await opened(backend);
    expect(registry.get(reviewViewAtom)).toEqual({ tag: 'ready' });
    expect(registry.get(statusBeforeAtom).size).toBe(0);
  });
});
