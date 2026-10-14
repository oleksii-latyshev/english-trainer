import { describe, expect, it } from 'bun:test';
import { startPractice } from '../helpers/review-session';
import { saveAgainAtom, submitTranscriptAtom } from '../model/answer-atoms';
import { lastTranscriptAtom } from '../model/capture-state';
import { sessionAtom } from '../model/session-atoms';
import { issueAtom } from '../model/view-atoms';
import { makeBackend } from './fakes';
import { commands, opened, runFn, session } from './harness';

describe('answering', () => {
  it('saves a spoken answer and shows its result', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    await runFn(
      registry,
      submitTranscriptAtom,
      'I said target 1',
      () => session(registry).step.tag === 'result',
    );
    expect(backend.calls.find((call) => call.command === 'submit_memory_recall')?.args).toEqual({
      run_id: 71,
      item_type: 'phrase',
      item_id: 51,
      transcript: 'I said target 1',
    });
    expect(session(registry).run.items[0].saved_response).toBe('remembered');
    expect(session(registry).pending).toBe('none');
  });

  it('does not send an answer over 4000 characters', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    await runFn(
      registry,
      submitTranscriptAtom,
      'x'.repeat(4001),
      () => session(registry).actionError !== null,
    );
    expect(session(registry).actionError).toBe('too-long');
    expect(commands(backend)).not.toContain('submit_memory_recall');
    expect(registry.get(issueAtom)?.fix).toBe('record-again');
  });

  it('keeps the words after a failed save and saves them again on request', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    backend.failing.add('submit_memory_recall');
    registry.set(lastTranscriptAtom, 'I said target 1');
    await runFn(
      registry,
      submitTranscriptAtom,
      'I said target 1',
      () => session(registry).actionError === 'save',
    );
    expect(registry.get(issueAtom)?.fix).toBe('save-again');
    backend.failing.clear();
    await runFn(registry, saveAgainAtom, undefined, () => session(registry).step.tag === 'result');
    expect(commands(backend).filter((command) => command === 'submit_memory_recall')).toHaveLength(
      2,
    );
  });

  it('refuses a result that does not match the queue as a failed save', async () => {
    const backend = makeBackend();
    backend.result = () => ({
      run_id: 99,
      position: 1,
      item_type: 'phrase',
      item_id: 51,
      cue: 'Cue 1',
      target: 'Target 1',
      transcript: 'x',
      wording_observed: true,
      saved_response: 'remembered',
      next_review_at: 1,
      interval_days: 1,
      status: 'learning',
    });
    const registry = await opened(backend);
    await runFn(
      registry,
      submitTranscriptAtom,
      'x',
      () => session(registry).actionError === 'save',
    );
    expect(session(registry).step.tag).toBe('answering');
  });
});

describe('practising after a saved answer', () => {
  it('scores nothing when the learner practises after the saved result', async () => {
    const backend = makeBackend();
    const registry = await opened(backend);
    await runFn(
      registry,
      submitTranscriptAtom,
      'first',
      () => session(registry).step.tag === 'result',
    );
    const before = commands(backend).length;
    registry.set(sessionAtom, startPractice(session(registry)));
    await runFn(registry, submitTranscriptAtom, 'second try', () => {
      const step = session(registry).step;
      return step.tag === 'result' && step.attempt.tag === 'tried';
    });
    expect(commands(backend).slice(before)).not.toContain('submit_memory_recall');
  });
});
