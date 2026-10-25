import { describe, expect, it } from 'bun:test';
import type { CaptureState } from '@/core/answer-capture';
import { exampleCueWasInterrupted, isAnswerCaptureStarted, isAnswerRecording } from './index';

const tags: CaptureState['tag'][] = [
  'idle',
  'requesting',
  'recording',
  'stopping',
  'ready',
  'transcribing',
  'transcript',
  'error',
];

function stateOf(tag: CaptureState['tag']): CaptureState {
  return { tag } as CaptureState;
}

describe('isAnswerCaptureStarted', () => {
  it('counts the wait for the microphone, so Example hides as soon as the stage says Listening', () => {
    const started = tags.filter((tag) => isAnswerCaptureStarted(stateOf(tag)));
    expect(started).toEqual(['requesting', 'recording']);
  });
});

describe('isAnswerRecording', () => {
  it('also covers the moment a recording is being stopped', () => {
    const recording = tags.filter((tag) => isAnswerRecording(stateOf(tag)));
    expect(recording).toEqual(['requesting', 'recording', 'stopping']);
  });
});

describe('exampleCueWasInterrupted', () => {
  it('is false only when no capture touched the request', () => {
    expect(exampleCueWasInterrupted(false, 1, 1, false)).toBe(false);
    expect(exampleCueWasInterrupted(true, 1, 1, false)).toBe(true);
    expect(exampleCueWasInterrupted(false, 1, 2, false)).toBe(true);
    expect(exampleCueWasInterrupted(false, 1, 1, true)).toBe(true);
  });
});
