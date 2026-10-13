import { describe, expect, it } from 'bun:test';
import { MicrophoneError, type MicrophoneTestState } from '@/core/audio';
import { recordLabel, testDescription } from '.';

const DISCONNECTED = new MicrophoneError({ reason: 'disconnected', message: 'unplugged' });
const INPUT = { deviceId: '', label: 'Fake' };
const RECORDED: MicrophoneTestState = {
  tag: 'recorded',
  playbackUrl: 'blob:clip',
  durationMs: 9600,
  signal: { capturedMs: 9600, elapsedMs: 10_000, windows: [] },
  input: INPUT,
};

describe('testDescription', () => {
  it('invites a recording first', () => {
    expect(testDescription({ tag: 'idle' })).toContain('stops by itself after 10 seconds');
  });

  it('counts the seconds while recording, never past the limit', () => {
    const recording = { tag: 'recording', elapsedMs: 3200, level: 0.2, input: INPUT } as const;
    expect(testDescription(recording)).toBe('Recording… 4 s of 10 s.');
    expect(testDescription({ ...recording, elapsedMs: 10_400 })).toBe('Recording… 10 s of 10 s.');
  });

  it('says the clip is neither saved nor transcribed', () => {
    expect(testDescription(RECORDED)).toBe('Ready to play back (10 s). Not saved or transcribed.');
  });

  it('shows the reason a recording failed', () => {
    const description = testDescription({ tag: 'error', failure: DISCONNECTED });
    expect(description).toBe(
      'The microphone disconnected during recording. Reconnect it and try again.',
    );
  });
});

describe('recordLabel', () => {
  it('offers Record again once there is an outcome', () => {
    expect(recordLabel({ tag: 'idle' })).toBe('Record');
    expect(recordLabel(RECORDED)).toBe('Record again');
    expect(recordLabel({ tag: 'error', failure: DISCONNECTED })).toBe('Record again');
  });
});
