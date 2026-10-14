import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { learningMemoryRuntime } from '@/core/learning-memory';
import { answerAtom, submitTranscriptAtom } from '../model/answer-atoms';
import { beginReview } from '../model/begin-review';
import { materialsPreparationAtom } from '../model/materials-atoms';
import { promptAtom, spokenPromptAtom } from '../model/prompt-atoms';
import { captureRuntime } from '../model/runtime';
import { reviewViewAtom, sessionAtom } from '../model/session-atoms';
import { captureLayer, learningLayer, makeBackend } from './fakes';
import { runFn, until } from './harness';

async function openedWithSituations(microphone: Parameters<typeof captureLayer>[0]) {
  const backend = makeBackend();
  const registry = AtomRegistry.make({
    initialValues: [
      [learningMemoryRuntime.layer, learningLayer(backend)],
      [captureRuntime.layer, captureLayer(microphone)],
    ],
  });
  beginReview(registry, 'review');
  registry.mount(reviewViewAtom);
  registry.mount(sessionAtom);
  registry.mount(promptAtom);
  registry.mount(spokenPromptAtom);
  await until(() => registry.get(reviewViewAtom).tag === 'ready');
  return registry;
}

const WAITING_MICROPHONE = {
  clip: () => Effect.never,
  transcript: () => Effect.succeed({ text: 'x', sttMs: 1 }),
  liveTexts: [],
};

describe('the prompt Eva gives', () => {
  it('starts from the cue and switches to the generated situation when it arrives', async () => {
    const registry = await openedWithSituations(WAITING_MICROPHONE);
    expect(registry.get(promptAtom)?.text).toBe('Cue 1');
    expect(registry.get(spokenPromptAtom)).toBe('Here is a situation. Cue 1');
    registry.mount(materialsPreparationAtom);
    await until(() => registry.get(promptAtom)?.text === 'A situation.');
    expect(registry.get(spokenPromptAtom)).toBe('Here is a situation. A situation.');
  });

  it('keeps the prompt of an answer in progress when the situation arrives late', async () => {
    const registry = await openedWithSituations(WAITING_MICROPHONE);
    registry.set(answerAtom, undefined);
    await until(() => registry.get(promptAtom)?.text === 'Cue 1');
    registry.mount(materialsPreparationAtom);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(registry.get(promptAtom)?.text).toBe('Cue 1');
  });

  it('is not read out once the answer is saved', async () => {
    const registry = await openedWithSituations(WAITING_MICROPHONE);
    await runFn(
      registry,
      submitTranscriptAtom,
      'said it',
      () => registry.get(spokenPromptAtom) === null,
    );
    expect(registry.get(sessionAtom)?.step.tag).toBe('result');
  });
});
