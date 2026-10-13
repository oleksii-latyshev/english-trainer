import { describe, expect, it } from 'bun:test';
import { AsyncResult } from 'effect/reactivity';
import { type ClipPhase, MicrophoneError } from '@/core/audio';
import { IpcError } from '@/core/ipc';
import { SentenceTooShort } from '../../errors';
import { micName, recorderHint, sentenceFailureMessage, sentenceRecorderState } from '.';

const INPUT = { deviceId: '', label: 'Fake' };
const IDLE: ClipPhase = { tag: 'idle' };
const RECORDING: ClipPhase = { tag: 'recording', elapsedMs: 900, level: 0.6, input: INPUT };

describe('sentenceRecorderState', () => {
  it('is idle when nothing is running', () => {
    const state = sentenceRecorderState({
      phase: IDLE,
      run: AsyncResult.initial(),
      isSaving: false,
    });
    expect(state).toEqual({ tag: 'idle' });
  });

  it('prepares, records, then saves while a run is in flight', () => {
    const run = AsyncResult.initial(true);
    expect(sentenceRecorderState({ phase: IDLE, run, isSaving: false }).tag).toBe('requesting');
    expect(sentenceRecorderState({ phase: RECORDING, run, isSaving: false })).toEqual({
      tag: 'recording',
      level: 0.6,
    });
    expect(
      sentenceRecorderState({ phase: { ...RECORDING, tag: 'stopping' }, run, isSaving: false }).tag,
    ).toBe('saving');
    expect(sentenceRecorderState({ phase: IDLE, run, isSaving: true }).tag).toBe('saving');
  });

  it('reports the failure of the last run', () => {
    const failure = new SentenceTooShort({ durationMs: 300 });
    const state = sentenceRecorderState({
      phase: IDLE,
      run: AsyncResult.fail(failure),
      isSaving: false,
    });
    expect(state).toEqual({ tag: 'error', failure });
  });
});

describe('sentenceFailureMessage', () => {
  it('asks for the whole sentence after a short recording', () => {
    expect(sentenceFailureMessage(new SentenceTooShort({ durationMs: 300 }))).toBe(
      'That was too short. Read the whole sentence.',
    );
  });

  it('words a lost device for the sentence', () => {
    const lost = new MicrophoneError({ reason: 'disconnected', message: 'x' });
    expect(sentenceFailureMessage(lost)).toContain('record the sentence again');
  });

  it('shows the message of a rejected save', () => {
    const rejected = new IpcError({ code: 'invalid_audio', message: 'The audio was unreadable.' });
    expect(sentenceFailureMessage(rejected)).toBe('The audio was unreadable.');
  });
});

describe('recorderHint and micName', () => {
  it('tells what to do next', () => {
    expect(recorderHint({ tag: 'idle' }, false)).toContain('read the sentence aloud');
    expect(recorderHint({ tag: 'idle' }, true)).toContain('replace the recording');
    expect(recorderHint({ tag: 'recording', level: 0 }, false)).toContain('then press stop');
  });

  it('names the microphone button by what it does', () => {
    expect(micName(true, true)).toBe('Stop recording');
    expect(micName(false, true)).toBe('Record this sentence again');
    expect(micName(false, false)).toBe('Record this sentence');
  });
});
