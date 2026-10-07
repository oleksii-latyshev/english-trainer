// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { type PauseSignals, pauseControl } from './pauseControl';

const QUIET: PauseSignals = {
  micStatus: 'ready',
  isRecording: false,
  isTranscribing: false,
  isBusy: false,
  isLocked: false,
};

describe('pauseControl', () => {
  it('offers Pause while the microphone is warm and nothing is happening', () => {
    expect(pauseControl(QUIET)).toEqual({ isPaused: false, disabledReason: undefined });
    expect(pauseControl({ ...QUIET, micStatus: 'warming' }).disabledReason).toBeUndefined();
  });

  it('offers Resume for a paused or failed microphone, whatever else is going on', () => {
    expect(pauseControl({ ...QUIET, micStatus: 'paused', isBusy: true })).toEqual({
      isPaused: true,
    });
    expect(pauseControl({ ...QUIET, micStatus: 'error', isRecording: true })).toEqual({
      isPaused: true,
    });
  });

  it('says why Pause cannot act', () => {
    expect(pauseControl({ ...QUIET, micStatus: 'off' }).disabledReason).toContain('not open');
    expect(pauseControl({ ...QUIET, micStatus: 'unmanaged' }).disabledReason).toContain('not open');
    expect(pauseControl({ ...QUIET, isRecording: true }).disabledReason).toContain('recording');
    expect(pauseControl({ ...QUIET, isTranscribing: true }).disabledReason).toContain(
      'transcribed',
    );
    expect(pauseControl({ ...QUIET, isBusy: true }).disabledReason).toContain('Eva is replying');
    expect(pauseControl({ ...QUIET, isLocked: true }).disabledReason).toContain('current step');
  });
});
