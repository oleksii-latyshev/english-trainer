import { describe, expect, it } from 'bun:test';
import { Effect, Layer } from 'effect';
import { AtomRegistry } from 'effect/reactivity';
import { captureRequestIdAtom, captureStateAtom } from '@/core/answer-capture';
import { microphoneSnapshotAtom } from '@/core/audio';
import { conversationFlowAtom, DEFAULT_CONVERSATION_FLOW } from '@/core/conversation-flow';
import { IpcError } from '@/core/ipc';
import { type PracticeState, practiceStateAtom } from '@/core/practice-session';
import { PracticeTurns, turnRuntime } from '@/core/practice-turn';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import { changeDraft, sendDraft } from '../model/commands';
import { draftAtom, isSendingAtom } from '../model/draft-atoms';
import { composerEffectsAtom } from '../model/effects';
import { submitAtom } from '../model/submit';
import { presentationAtom, turnStateAtom } from '../model/view-atoms';
import { aSessionDetails } from './builders';

installFakeLocalStorage();
Reflect.set(globalThis, 'isTauri', true);

type Script = { sent: Array<{ transcript: string; source: string }>; fails: boolean };

const TURN = {
  spoken_reply: 'Nice.',
  question: 'Why?',
  session_phase: 'practice',
  is_complete: false,
};

function fakeTurns(script: Script) {
  return Layer.succeed(PracticeTurns, {
    send: (request) =>
      Effect.suspend(() => {
        script.sent.push({ transcript: request.transcript, source: request.source });
        return script.fails
          ? Effect.fail(new IpcError({ code: 'timeout', message: 'Too slow.' }))
          : Effect.succeed(TURN);
      }),
    cancel: () => Effect.succeed(false),
  });
}

function opened(flow: Partial<typeof DEFAULT_CONVERSATION_FLOW>, script: Script) {
  const registry = AtomRegistry.make({
    initialValues: [[turnRuntime.layer, fakeTurns(script)]],
  });
  const state: PracticeState = { tag: 'active', ...aSessionDetails() };
  registry.set(practiceStateAtom, state);
  registry.set(conversationFlowAtom, { ...DEFAULT_CONVERSATION_FLOW, ...flow });
  registry.mount(practiceStateAtom);
  registry.mount(draftAtom);
  registry.mount(turnStateAtom);
  registry.mount(submitAtom);
  registry.mount(isSendingAtom);
  registry.mount(composerEffectsAtom);
  registry.mount(microphoneSnapshotAtom);
  registry.set(microphoneSnapshotAtom, { status: 'ready', error: '' });
  return registry;
}

function hear(registry: AtomRegistry.AtomRegistry, text: string) {
  registry.update(captureRequestIdAtom, (id) => id + 1);
  registry.set(captureStateAtom, {
    tag: 'transcript',
    text,
    durationMs: 3000,
    speechStoppedAtMs: 1,
  });
}

async function until(check: () => boolean) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('the composer never reached the expected state');
}

const MANUAL_SEND = { autoSendVoice: false };

describe('what the learner said', () => {
  it('lands in the draft for a last edit', () => {
    const registry = opened(MANUAL_SEND, { sent: [], fails: false });
    hear(registry, 'I use a notebook.');
    expect(registry.get(draftAtom)).toEqual({
      text: 'I use a notebook.',
      recognizedText: 'I use a notebook.',
      isNewVoice: true,
    });
    expect(registry.get(turnStateAtom).tag).toBe('review');
    expect(registry.get(presentationAtom).stageTitle).toBe('Check your words');
  });

  it('is sent at once, as spoken, when the learner is fully hands-free', async () => {
    const script: Script = { sent: [], fails: false };
    const registry = opened({ autoSendVoice: true, autoListen: true, handsFree: true }, script);
    hear(registry, 'I use a notebook.');
    await until(() => script.sent.length === 1);
    expect(script.sent[0]).toEqual({ transcript: 'I use a notebook.', source: 'voice' });
    await until(() => registry.get(draftAtom).text === '');
  });

  it('is not sent when voice answers wait for the learner', async () => {
    const script: Script = { sent: [], fails: false };
    const registry = opened(MANUAL_SEND, script);
    hear(registry, 'I use a notebook.');
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(script.sent).toEqual([]);
  });

  it('counts down before sending when the learner may still edit', () => {
    const registry = opened(
      { autoSendVoice: true, autoListen: false, handsFree: true, autoSendDelayMs: 5000 },
      { sent: [], fails: false },
    );
    hear(registry, 'I use a notebook.');
    const state = registry.get(turnStateAtom);
    expect(state.tag).toBe('review');
    expect(state.tag === 'review' && state.sendingLabel).toContain('Sending in');
  });

  it('stops the countdown as soon as the learner edits the text', async () => {
    const script: Script = { sent: [], fails: false };
    const registry = opened(
      { autoSendVoice: true, autoListen: false, handsFree: true, autoSendDelayMs: 100 },
      script,
    );
    hear(registry, 'I use a notebook.');
    changeDraft(registry, 'I use a notebook every day.');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(script.sent).toEqual([]);
  });
});

describe('sending the draft', () => {
  it('marks an edited voice answer as edited and a typed one as typed', async () => {
    const script: Script = { sent: [], fails: false };
    const registry = opened(MANUAL_SEND, script);
    hear(registry, 'I use a notebook.');
    changeDraft(registry, 'I use a paper notebook.');
    sendDraft(registry);
    await until(() => script.sent.length === 1);
    expect(script.sent[0]?.source).toBe('edited');
  });

  it('keeps the draft when the reply could not be generated', async () => {
    const script: Script = { sent: [], fails: true };
    const registry = opened(MANUAL_SEND, script);
    changeDraft(registry, 'I typed this.');
    sendDraft(registry);
    await until(() => script.sent.length === 1);
    await until(() => !registry.get(isSendingAtom));
    expect(registry.get(draftAtom).text).toBe('I typed this.');
  });

  it('forgets the draft once the reply arrived', async () => {
    const script: Script = { sent: [], fails: false };
    const registry = opened(MANUAL_SEND, script);
    changeDraft(registry, 'I typed this.');
    sendDraft(registry);
    await until(() => registry.get(draftAtom).text === '');
    expect(script.sent[0]).toEqual({ transcript: 'I typed this.', source: 'text' });
  });
});
