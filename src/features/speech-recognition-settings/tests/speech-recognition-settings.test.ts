import { describe, expect, it } from 'bun:test';
import { Effect, Option } from 'effect';
import { AsyncResult, type Atom, AtomRegistry } from 'effect/reactivity';
import {
  deleteSpeechCheckRecordingsAtom,
  engineStatusAtom,
  measureModelsAtom,
  measurementProgressAtom,
  recordSentenceAtom,
  saveLiveTranscriptAtom,
  saveSpeechModelAtom,
  selectedSentenceAtom,
  speechCheckAtom,
  speechModelsAtom,
  speechSettingsAtom,
} from '../model/atoms';
import { runtime } from '../model/runtime';
import { type FakeClip, makeFakes, makeState } from './fakes';

function makeRegistry(clip: FakeClip = { durationMs: 3000 }) {
  const state = makeState();
  const fakes = makeFakes(state, () => clip);
  const registry = AtomRegistry.make({
    initialValues: [[runtime.layer, fakes.feature]],
  });
  registry.mount(speechSettingsAtom);
  registry.mount(speechCheckAtom);
  registry.mount(selectedSentenceAtom);
  return { registry, state, saved: fakes.saved };
}

async function settled<A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) {
  return Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }));
}

async function until<A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  predicate: (value: A) => boolean,
) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const result = registry.get(atom);
    if (AsyncResult.isSuccess(result) && predicate(result.value)) return result.value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('the atom never reached the expected value');
}

async function run<Arg, A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Writable<AsyncResult.AsyncResult<A, E>, Arg>,
  arg: Arg,
) {
  registry.mount(atom);
  registry.set(atom, arg);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    const result = registry.get(atom);
    if (!AsyncResult.isWaiting(result) && !AsyncResult.isInitial(result)) return result;
  }
  throw new Error('the command never finished');
}

describe('reading', () => {
  it('reads the settings, the installed models and the speech check', async () => {
    const { registry } = makeRegistry();
    expect((await settled(registry, speechSettingsAtom)).model_file).toBe('ggml-base.en.bin');
    expect((await settled(registry, speechModelsAtom)).models).toHaveLength(2);
    expect((await settled(registry, speechCheckAtom)).sentences).toHaveLength(3);
  });

  it('keeps asking for the model in memory while it is open', async () => {
    const { registry, state } = makeRegistry();
    registry.mount(engineStatusAtom);
    expect((await until(registry, engineStatusAtom, () => true)).server).toBe('ready');
    state.engine = {
      server: 'not_running',
      failure: 'No server.',
      is_live_transcript_available: false,
    };
    const next = await until(
      registry,
      engineStatusAtom,
      (status) => status.server === 'not_running',
    );
    expect(next.failure).toBe('No server.');
  });
});

describe('settings', () => {
  it('saving a model refreshes the chosen model', async () => {
    const { registry } = makeRegistry();
    await settled(registry, speechSettingsAtom);
    await run(registry, saveSpeechModelAtom, 'ggml-small.en.bin');
    const next = await until(registry, speechSettingsAtom, (value) =>
      value.model_file.includes('small'),
    );
    expect(next.model_file).toBe('ggml-small.en.bin');
  });

  it('switching the live transcript refreshes the setting', async () => {
    const { registry } = makeRegistry();
    await settled(registry, speechSettingsAtom);
    await run(registry, saveLiveTranscriptAtom, false);
    const next = await until(registry, speechSettingsAtom, (value) => !value.live_transcript);
    expect(next.live_transcript).toBe(false);
  });
});

describe('speech check', () => {
  it('saves a recorded sentence and moves to the next one still to read', async () => {
    const { registry, saved } = makeRegistry();
    await settled(registry, speechCheckAtom);
    await run(registry, recordSentenceAtom, { index: 1, deviceId: 'usb' });
    expect(saved).toEqual([{ index: '1', size: 3 }]);
    expect(registry.get(selectedSentenceAtom)).toBe(2);
    const check = await until(registry, speechCheckAtom, (value) =>
      value.sentences.some((sentence) => sentence.is_recorded),
    );
    expect(check.sentences.map((sentence) => sentence.is_recorded)).toEqual([true, false, false]);
  });

  it('does not save a recording that is too short', async () => {
    const { registry, saved } = makeRegistry({ durationMs: 300 });
    const result = await run(registry, recordSentenceAtom, { index: 1, deviceId: 'usb' });
    expect(AsyncResult.isFailure(result)).toBe(true);
    expect(saved).toHaveLength(0);
    expect(AsyncResult.error(result).pipe(Option.map((failure) => failure._tag))).toEqual(
      Option.some('SentenceTooShort'),
    );
  });

  it('reports a recording the backend rejected', async () => {
    const { registry, state } = makeRegistry();
    state.failSaving = true;
    const result = await run(registry, recordSentenceAtom, { index: 1, deviceId: 'usb' });
    expect(AsyncResult.error(result).pipe(Option.map((failure) => failure._tag))).toEqual(
      Option.some('IpcDecodeError'),
    );
  });

  it('deleting the recordings starts again at the first sentence', async () => {
    const { registry } = makeRegistry();
    await run(registry, recordSentenceAtom, { index: 1, deviceId: 'usb' });
    await run(registry, deleteSpeechCheckRecordingsAtom, undefined);
    expect(registry.get(selectedSentenceAtom)).toBe(1);
    const check = await until(registry, speechCheckAtom, (value) =>
      value.sentences.every((sentence) => !sentence.is_recorded),
    );
    expect(check.sentences).toHaveLength(3);
  });
});

describe('measuring models', () => {
  it('keeps the numbers of a run and clears the progress', async () => {
    const { registry } = makeRegistry();
    registry.mount(measurementProgressAtom);
    await run(registry, measureModelsAtom, {
      modelFiles: ['ggml-base.en.bin'],
      includePrompt: false,
    });
    const check = await until(registry, speechCheckAtom, (value) => value.results.runs.length > 0);
    expect(check.results.runs).toHaveLength(1);
    expect(Option.isNone(registry.get(measurementProgressAtom))).toBe(true);
  });
});
