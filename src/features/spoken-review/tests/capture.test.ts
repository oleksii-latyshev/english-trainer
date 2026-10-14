import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { MIC_DISCONNECTED_MESSAGE, MicrophoneError } from '@/core/audio';
import { IpcError } from '@/core/ipc';
import { learningMemoryRuntime } from '@/core/learning-memory';
import { answerAtom, transcribeAgainAtom } from '../model/answer-atoms';
import { cancelAnswer } from '../model/answer-controls';
import { beginReview } from '../model/begin-review';
import { captureOutcomeAtom, liveTextAtom } from '../model/capture-state';
import { captureRuntime } from '../model/runtime';
import { reviewViewAtom, sessionAtom } from '../model/session-atoms';
import { issueAtom } from '../model/view-atoms';
import { A_CLIP, captureLayer, learningLayer, type Microphone, makeBackend } from './fakes';
import { until } from './harness';

const DISCONNECTED = new MicrophoneError({
  reason: 'disconnected',
  message: MIC_DISCONNECTED_MESSAGE,
});

function recorded(overrides: Partial<Microphone> = {}) {
  const backend = makeBackend();
  const microphone: Microphone = {
    clip: () => Effect.succeed(A_CLIP),
    transcript: () => Effect.succeed({ text: 'I said target 1', sttMs: 120 }),
    liveTexts: [],
    ...overrides,
  };
  const registry = AtomRegistry.make({
    initialValues: [
      [learningMemoryRuntime.layer, learningLayer(backend)],
      [captureRuntime.layer, captureLayer(microphone)],
    ],
  });
  beginReview(registry, 'review');
  registry.mount(reviewViewAtom);
  registry.mount(sessionAtom);
  registry.mount(captureOutcomeAtom);
  registry.mount(liveTextAtom);
  registry.mount(issueAtom);
  registry.mount(answerAtom);
  registry.mount(transcribeAgainAtom);
  return { registry, backend };
}

async function readyToAnswer(overrides: Partial<Microphone> = {}) {
  const review = recorded(overrides);
  await until(() => review.registry.get(reviewViewAtom).tag === 'ready');
  return review;
}

function stepOf(registry: AtomRegistry.AtomRegistry) {
  return registry.get(sessionAtom)?.step.tag;
}

describe('recording an answer', () => {
  it('saves the final transcript of the recording and shows the result', async () => {
    const { registry, backend } = await readyToAnswer();
    registry.set(answerAtom, undefined);
    await until(() => stepOf(registry) === 'result');
    expect(
      backend.calls
        .filter((call) => call.command === 'submit_memory_recall')
        .map((call) => call.args.transcript),
    ).toEqual(['I said target 1']);
    expect(registry.get(captureOutcomeAtom)).toEqual({ tag: 'idle' });
  });

  it('shows the microphone problem and saves nothing', async () => {
    const { registry, backend } = await readyToAnswer({
      clip: () => Effect.fail(DISCONNECTED),
    });
    registry.set(answerAtom, undefined);
    await until(() => registry.get(captureOutcomeAtom).tag === 'microphone-failed');
    expect(registry.get(issueAtom)).toEqual({
      message: DISCONNECTED.message,
      fix: 'record-again',
    });
    expect(backend.calls.map((call) => call.command)).not.toContain('submit_memory_recall');
  });

  it('keeps the recording for a retry when transcription fails and saves after the retry', async () => {
    let attempts = 0;
    const { registry, backend } = await readyToAnswer({
      transcript: () => {
        attempts += 1;
        return attempts === 1
          ? Effect.fail(new IpcError({ code: 'timeout', message: 'The speech engine was slow.' }))
          : Effect.succeed({ text: 'I said target 1', sttMs: 90 });
      },
    });
    registry.set(answerAtom, undefined);
    await until(() => registry.get(captureOutcomeAtom).tag === 'transcription-failed');
    expect(registry.get(issueAtom)?.fix).toBe('transcribe-again');
    registry.set(transcribeAgainAtom, undefined);
    await until(() => stepOf(registry) === 'result');
    expect(attempts).toBe(2);
    expect(backend.calls.filter((call) => call.command === 'submit_memory_recall')).toHaveLength(1);
  });

  it('asks to record again when nothing was recognised', async () => {
    const { registry, backend } = await readyToAnswer({
      transcript: () => Effect.succeed({ text: '   ', sttMs: 80 }),
    });
    registry.set(answerAtom, undefined);
    await until(() => registry.get(captureOutcomeAtom).tag === 'transcription-failed');
    expect(registry.get(issueAtom)?.fix).toBe('record-again');
    expect(backend.calls.map((call) => call.command)).not.toContain('submit_memory_recall');
  });

  it('sends the setup problem to Settings', async () => {
    const { registry } = await readyToAnswer({
      transcript: () =>
        Effect.fail(new IpcError({ code: 'model_missing', message: 'Download a model first.' })),
    });
    registry.set(answerAtom, undefined);
    await until(() => registry.get(captureOutcomeAtom).tag === 'transcription-failed');
    expect(registry.get(issueAtom)?.fix).toBe('open-settings');
  });
});

describe('cancelling an answer', () => {
  it('drops the recording, its live words and anything it would save', async () => {
    const { registry, backend } = await readyToAnswer({
      clip: () => Effect.never,
      liveTexts: ['A provisional suggestion'],
    });
    registry.set(answerAtom, undefined);
    await until(() => registry.get(liveTextAtom) === 'A provisional suggestion');
    cancelAnswer(registry);
    expect(registry.get(liveTextAtom)).toBe('');
    expect(registry.get(captureOutcomeAtom)).toEqual({ tag: 'idle' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(registry.get(liveTextAtom)).toBe('');
    expect(backend.calls.map((call) => call.command)).not.toContain('submit_memory_recall');
    expect(stepOf(registry)).toBe('answering');
  });
});
