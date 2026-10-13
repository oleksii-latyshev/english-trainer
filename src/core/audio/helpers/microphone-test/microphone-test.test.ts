import { expect, it } from 'bun:test';
import { AsyncResult } from 'effect/reactivity';
import { microphoneDisconnected, microphoneNoAudio } from '../../errors';
import { isMicrophoneTestCapturing, microphoneTestFailureMessage, microphoneTestState } from '.';

const INPUT = { deviceId: '', label: 'Fake' };
const RECORDING = {
  playbackUrl: 'blob:clip',
  durationMs: 4000,
  signal: { capturedMs: 4000, elapsedMs: 4100, windows: [] },
  input: INPUT,
};

it('is idle before the first recording', () => {
  expect(microphoneTestState({ tag: 'idle' }, AsyncResult.initial()).tag).toBe('idle');
});

it('follows the recorder while a run is in flight', () => {
  const waiting = AsyncResult.initial(true);
  expect(microphoneTestState({ tag: 'idle' }, waiting).tag).toBe('requesting');
  const phase = { tag: 'recording', elapsedMs: 300, level: 0.4, input: INPUT } as const;
  expect(microphoneTestState(phase, waiting)).toEqual(phase);
});

it('ignores a stale recorder phase once the run has finished', () => {
  const phase = { tag: 'recording', elapsedMs: 300, level: 0.4, input: INPUT } as const;
  const state = microphoneTestState(phase, AsyncResult.success(RECORDING));
  expect(state).toEqual({ tag: 'recorded', ...RECORDING });
});

it('keeps the previous recording out of a new run', () => {
  const rerun = AsyncResult.waiting(AsyncResult.success(RECORDING));
  expect(microphoneTestState({ tag: 'idle' }, rerun).tag).toBe('requesting');
});

it('reports a failed run', () => {
  const state = microphoneTestState({ tag: 'idle' }, AsyncResult.fail(microphoneNoAudio));
  expect(state).toEqual({ tag: 'error', failure: microphoneNoAudio });
});

it('words a lost device for the check', () => {
  expect(microphoneTestFailureMessage(microphoneDisconnected)).toContain('during recording');
  expect(microphoneTestFailureMessage(microphoneNoAudio)).toBe(microphoneNoAudio.message);
});

it('counts requesting, recording and stopping as capturing', () => {
  expect(isMicrophoneTestCapturing({ tag: 'requesting' })).toBe(true);
  expect(isMicrophoneTestCapturing({ tag: 'idle' })).toBe(false);
});
