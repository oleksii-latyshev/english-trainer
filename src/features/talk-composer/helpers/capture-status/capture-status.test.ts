import { describe, expect, it } from 'bun:test';
import type { CaptureState } from '@/core/answer-capture';
import { captureStatusOf, listeningOf } from '.';

const LISTENING = {
  elapsedMs: 0,
  level: 0,
  mode: 'manual',
  held: false,
  heardSpeech: false,
  liveText: '',
} as const;

describe('capture status', () => {
  it('reads transcription and a finished transcript as a recording that is ready', () => {
    const transcript: CaptureState = {
      tag: 'transcript',
      text: 'Hello',
      durationMs: 1000,
      speechStoppedAtMs: 1,
    };
    expect(captureStatusOf(transcript)).toBe('ready');
    expect(
      captureStatusOf({
        tag: 'transcribing',
        playbackUrl: 'blob:x',
        durationMs: 1,
        speechStoppedAtMs: 1,
      }),
    ).toBe('ready');
  });

  it('keeps the other states as they are', () => {
    expect(captureStatusOf({ tag: 'idle' })).toBe('idle');
    expect(captureStatusOf({ tag: 'error', message: 'x' })).toBe('error');
    expect(captureStatusOf({ tag: 'recording', ...LISTENING })).toBe('recording');
  });

  it('exposes the listening fields only while recording or stopping', () => {
    expect(listeningOf({ tag: 'idle' })).toBeUndefined();
    expect(listeningOf({ tag: 'stopping', ...LISTENING })?.mode).toBe('manual');
  });
});
