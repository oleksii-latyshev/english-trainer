import { describe, expect, it } from 'bun:test';
import type { CaptureState } from '@/core/answer-capture';
import { capturePhaseOf } from '.';

const recording = {
  playbackUrl: 'blob:clip',
  durationMs: 1200,
  speechStoppedAtMs: 1100,
};

const listening = {
  elapsedMs: 800,
  level: 0.2,
  mode: 'manual' as const,
  held: false,
  heardSpeech: true,
  liveText: '',
};

describe('capturePhaseOf', () => {
  it('groups the states that a learner sees as one recording', () => {
    expect(capturePhaseOf({ tag: 'idle' })).toBe('idle');
    expect(capturePhaseOf({ tag: 'stopping', ...listening })).toBe('capturing');
    expect(capturePhaseOf({ tag: 'recording', ...listening })).toBe('capturing');
  });

  it('waits for the microphone before it records', () => {
    expect(capturePhaseOf({ tag: 'requesting' })).toBe('requesting');
  });

  it('tells a transcript being compared from audio being transcribed', () => {
    const transcribing: CaptureState = { tag: 'transcribing', ...recording };
    const transcript: CaptureState = {
      tag: 'transcript',
      text: 'I work there now',
      durationMs: 1200,
      speechStoppedAtMs: 1100,
    };
    expect(capturePhaseOf(transcribing)).toBe('transcribing');
    expect(capturePhaseOf(transcript)).toBe('comparing');
  });

  it('separates a kept recording that can be transcribed again from a failed one', () => {
    expect(capturePhaseOf({ tag: 'ready', ...recording })).toBe('kept');
    expect(capturePhaseOf({ tag: 'error', message: 'No speech heard.' })).toBe('failed');
  });
});
