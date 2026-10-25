import { describe, expect, it } from 'bun:test';
import { recorderViewOf } from './index';

describe('recorderViewOf', () => {
  it('shows a kept recording as ready with its playback', () => {
    const view = recorderViewOf({
      tag: 'ready',
      playbackUrl: 'blob:take',
      durationMs: 2_000,
      speechStoppedAtMs: 1,
      failure: { kind: 'retry', message: 'Try again.' },
    });
    expect(view.status).toBe('ready');
    expect(view.playbackUrl).toBe('blob:take');
    expect(view.failure?.kind).toBe('retry');
    expect(view.transcript).toBe('');
  });

  it('carries the trimmed transcript once transcribed', () => {
    const view = recorderViewOf({
      tag: 'transcript',
      text: '  it saves me time  ',
      durationMs: 3_000,
      speechStoppedAtMs: 1,
    });
    expect(view.status).toBe('ready');
    expect(view.transcript).toBe('it saves me time');
    expect(view.playbackUrl).toBeUndefined();
  });

  it('keeps the elapsed time while recording and reports a plain error message', () => {
    const recording = recorderViewOf({
      tag: 'recording',
      elapsedMs: 4_000,
      level: 0.2,
      mode: 'manual',
      held: false,
      heardSpeech: true,
      liveText: '',
    });
    expect(recording.status).toBe('recording');
    expect(recording.elapsedMs).toBe(4_000);
    expect(recorderViewOf({ tag: 'error', message: 'No microphone.' }).error).toBe(
      'No microphone.',
    );
  });

  it('marks transcribing so the retry button can wait', () => {
    const view = recorderViewOf({
      tag: 'transcribing',
      playbackUrl: 'blob:take',
      durationMs: 1_000,
      speechStoppedAtMs: 1,
    });
    expect(view.isTranscribing).toBe(true);
    expect(view.status).toBe('ready');
  });
});
