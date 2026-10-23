import { describe, expect, it } from 'bun:test';
import type { RecordingStatus } from './practiceViewModel';
import { isAnswerCaptureStarted } from './useExampleCaptureGuard';

describe('isAnswerCaptureStarted', () => {
  it('counts the wait for the microphone, so Example hides as soon as the stage says Listening', () => {
    const started: RecordingStatus[] = ['requesting', 'recording'];
    const notStarted: RecordingStatus[] = ['idle', 'stopping', 'ready', 'error'];
    expect(started.map(isAnswerCaptureStarted)).toEqual([true, true]);
    expect(notStarted.map(isAnswerCaptureStarted)).toEqual([false, false, false, false]);
  });
});
