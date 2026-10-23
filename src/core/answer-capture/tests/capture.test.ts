import { describe, expect, it } from 'bun:test';
import { conversationFlowAtom, DEFAULT_CONVERSATION_FLOW } from '@/core/conversation-flow';
import { IpcError } from '@/core/ipc';
import {
  cancelListening,
  holdListening,
  resetCapture,
  startListening,
  stopListening,
  transcribeAgain,
} from '../model/controls';
import { listenAtom, transcribeAgainAtom } from '../model/listen';
import {
  captureControlAtom,
  captureRequestIdAtom,
  captureStateAtom,
  captureTimingAtom,
  recordedClipAtom,
} from '../model/state';
import { aMicrophone, openCapture, until } from './harness';

function opened(microphone = aMicrophone()) {
  const registry = openCapture(microphone);
  registry.mount(captureStateAtom);
  registry.mount(captureControlAtom);
  registry.mount(listenAtom);
  registry.mount(transcribeAgainAtom);
  registry.mount(captureTimingAtom);
  registry.mount(recordedClipAtom);
  return { registry, microphone };
}

const MANUAL = { mode: 'manual', discardPreRoll: false } as const;

async function recording(microphone = aMicrophone()) {
  const context = opened(microphone);
  startListening(context.registry, MANUAL);
  await until(() => context.registry.get(captureStateAtom).tag === 'recording');
  return context;
}

describe('recording an answer', () => {
  it('listens on the microphone it was given', async () => {
    const { registry } = opened();
    startListening(registry, MANUAL);
    await until(() => registry.get(captureStateAtom).tag === 'recording');
    expect(registry.get(captureStateAtom)).toMatchObject({
      mode: 'manual',
      heardSpeech: false,
      actualInput: { label: 'Fake microphone' },
    });
  });

  it('turns the recording into a transcript and measures each stage', async () => {
    const { registry, microphone } = await recording();
    stopListening(registry);
    await until(() => registry.get(captureStateAtom).tag === 'transcript');
    expect(registry.get(captureStateAtom)).toMatchObject({
      text: 'I use a notebook.',
      durationMs: 1800,
    });
    expect(registry.get(captureTimingAtom).sttMs).toBe(140);
    expect(registry.get(captureTimingAtom).captureStartMs).toBeGreaterThanOrEqual(0);
    expect(microphone.released).toBe(true);
    expect(registry.get(recordedClipAtom)).toBeNull();
  });

  it('ignores a second start while one is running', async () => {
    const { registry } = await recording();
    const requestId = registry.get(captureRequestIdAtom);
    startListening(registry, MANUAL);
    expect(registry.get(captureRequestIdAtom)).toBe(requestId);
  });

  it('gives every new recording its own request id', async () => {
    const { registry } = await recording();
    const first = registry.get(captureRequestIdAtom);
    resetCapture(registry);
    startListening(registry, MANUAL);
    expect(registry.get(captureRequestIdAtom)).toBeGreaterThan(first);
  });
});

describe('cancelling', () => {
  it('releases the microphone and goes back to idle', async () => {
    const { registry, microphone } = await recording();
    cancelListening(registry);
    expect(registry.get(captureStateAtom).tag).toBe('idle');
    await until(() => microphone.released);
    expect(microphone.stopRequested).toBe(0);
  });

  it('does nothing when nothing is recording', () => {
    const { registry } = opened();
    const requestId = registry.get(captureRequestIdAtom);
    cancelListening(registry);
    expect(registry.get(captureRequestIdAtom)).toBe(requestId);
  });
});

describe('a failed transcription', () => {
  const FAILED = new IpcError({ code: 'process_failed', message: 'Whisper stopped.' });

  it('keeps the recording so it can be transcribed again', async () => {
    const { registry } = await recording(
      aMicrophone({ transcripts: [FAILED, { text: 'Second time.', sttMs: 90 }] }),
    );
    stopListening(registry);
    await until(() => registry.get(captureStateAtom).tag === 'ready');
    expect(registry.get(captureStateAtom)).toMatchObject({
      failure: { kind: 'retry', message: 'Whisper stopped.' },
    });
    expect(registry.get(recordedClipAtom)).not.toBeNull();
    transcribeAgain(registry);
    await until(() => registry.get(captureStateAtom).tag === 'transcript');
    expect(registry.get(captureStateAtom)).toMatchObject({ text: 'Second time.' });
  });

  it('asks to record again when no speech was found', async () => {
    const { registry } = await recording(aMicrophone({ transcripts: [{ text: '  ', sttMs: 10 }] }));
    stopListening(registry);
    await until(() => registry.get(captureStateAtom).tag === 'error');
    expect(registry.get(captureStateAtom)).toMatchObject({ failure: { kind: 'record_again' } });
    expect(registry.get(recordedClipAtom)).toBeNull();
  });
});

describe('hands-free turns', () => {
  const NOT_HANDS_FREE = { ...DEFAULT_CONVERSATION_FLOW, handsFree: false };

  it('ends the turn by itself after the pause', async () => {
    const { registry } = opened(
      aMicrophone({ turns: [{ _tag: 'SpeechStarted' }, { _tag: 'TurnEnded' }] }),
    );
    registry.set(conversationFlowAtom, { ...DEFAULT_CONVERSATION_FLOW, handsFree: true });
    startListening(registry, MANUAL);
    await until(() => registry.get(captureStateAtom).tag === 'transcript');
  });

  it('keeps listening when hands-free is off', async () => {
    const { registry } = opened(
      aMicrophone({ turns: [{ _tag: 'SpeechStarted' }, { _tag: 'TurnEnded' }] }),
    );
    registry.set(conversationFlowAtom, NOT_HANDS_FREE);
    startListening(registry, MANUAL);
    await until(() => registry.get(captureStateAtom).tag === 'recording');
    await until(() => {
      const state = registry.get(captureStateAtom);
      return state.tag === 'recording' && state.heardSpeech;
    });
    expect(registry.get(captureStateAtom).tag).toBe('recording');
  });

  it('treats a stop before any speech as a cancel', async () => {
    const { registry } = opened(aMicrophone({ turns: [] }));
    startListening(registry, MANUAL);
    await until(() => registry.get(captureStateAtom).tag === 'recording');
    stopListening(registry);
    expect(registry.get(captureStateAtom).tag).toBe('idle');
  });

  it('marks the turn as held open while the learner keeps thinking', async () => {
    const { registry } = await recording();
    holdListening(registry, true);
    expect(registry.get(captureStateAtom)).toMatchObject({ held: true });
  });
});

describe('auto-listen', () => {
  it('does not start when the microphone is not warm', () => {
    const { registry } = opened();
    startListening(registry, { mode: 'auto', discardPreRoll: false });
    expect(registry.get(captureStateAtom).tag).toBe('idle');
  });
});
