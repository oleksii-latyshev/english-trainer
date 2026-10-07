// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { isCapturing, PRE_ROLL_MS, preRollMsFor, viewFor } from './captureView';

describe('capture view', () => {
  it('exposes listening details only while recording or stopping', () => {
    const recording = viewFor(
      {
        tag: 'recording',
        elapsedMs: 1200,
        level: 0.4,
        mode: 'auto',
        held: true,
        heardSpeech: true,
      },
      {},
      3,
      { status: 'ready', error: '' },
    );
    expect(recording).toMatchObject({
      status: 'recording',
      elapsedMs: 1200,
      level: 0.4,
      recordingMode: 'auto',
      held: true,
      heardSpeech: true,
      micStatus: 'ready',
    });
    const idle = viewFor({ tag: 'idle' }, {}, 3);
    expect(idle).toMatchObject({
      status: 'idle',
      level: 0,
      recordingMode: undefined,
      held: false,
      heardSpeech: false,
      micStatus: 'unmanaged',
    });
  });

  it('keeps the transcript view unchanged for a finished answer', () => {
    const view = viewFor(
      { tag: 'transcript', text: 'hello', durationMs: 900, speechStoppedAtMs: 5 },
      { sttMs: 300, captureStartMs: 4 },
      7,
    );
    expect(view).toMatchObject({ status: 'ready', transcript: 'hello', currentRequestId: 7 });
    expect(view.timing.captureStartMs).toBe(4);
  });

  it('uses pre-roll for a quiet manual press only', () => {
    expect(preRollMsFor('manual', false)).toBe(PRE_ROLL_MS);
    expect(preRollMsFor('manual', true)).toBe(0);
    expect(preRollMsFor('auto', false)).toBe(0);
    expect(preRollMsFor('auto', true)).toBe(0);
  });

  it('treats the whole record-to-transcript span as capturing', () => {
    expect(isCapturing({ tag: 'requesting' })).toBe(true);
    expect(isCapturing({ tag: 'transcript', text: 'x', durationMs: 1, speechStoppedAtMs: 0 })).toBe(
      false,
    );
    expect(isCapturing({ tag: 'idle' })).toBe(false);
  });
});
