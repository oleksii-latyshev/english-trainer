// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type { SpeechEngineStatus, SpeechSettings } from '@/lib/speechTypes';
import { engineLabel, engineProblem, liveTranscriptDescription } from './engineStatus';

const ready: SpeechEngineStatus = {
  server: 'ready',
  failure: null,
  is_live_transcript_available: true,
};
const settings: SpeechSettings = {
  model_file: 'ggml-small.en.bin',
  keep_raw_audio: false,
  live_transcript: true,
};

describe('speech engine status text', () => {
  it('names each state of the loaded model', () => {
    expect(engineLabel(ready)).toBe('Kept loaded · ready');
    expect(engineLabel({ ...ready, server: 'loading' })).toBe('Loading…');
    expect(engineLabel({ ...ready, server: 'not_running' })).toBe(
      'Not running (using one-off runs)',
    );
  });

  it('shows why it is not running only when starting it failed', () => {
    expect(engineProblem({ ...ready, server: 'not_running', failure: 'it stopped' })).toBe(
      'it stopped',
    );
    expect(engineProblem({ ...ready, server: 'not_running' })).toBe('');
    expect(engineProblem(ready)).toBe('');
  });

  it('explains the live transcript switch and a model that is too slow for it', () => {
    expect(liveTranscriptDescription({ ...settings, live_transcript: false }, ready)).toMatch(
      /^Off/,
    );
    expect(liveTranscriptDescription(settings, ready)).toMatch(/^On: /);
    expect(
      liveTranscriptDescription(settings, { ...ready, is_live_transcript_available: false }),
    ).toMatch(/too slow/);
  });
});
