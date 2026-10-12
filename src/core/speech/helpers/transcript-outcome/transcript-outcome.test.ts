import { expect, test } from 'bun:test';
import { IpcError } from '@/core/ipc';
import { transcriptionFailureOutcome, transcriptOutcome } from '.';

test('words become a transcript', () => {
  expect(transcriptOutcome('I went home')).toEqual({ tag: 'transcript', text: 'I went home' });
});

test('blank text asks the learner to record again', () => {
  const outcome = transcriptOutcome('   ');
  expect(outcome.tag).toBe('no-speech');
  expect(outcome.tag === 'no-speech' && outcome.failure.kind).toBe('record_again');
});

test('a retryable failure keeps the recording for another attempt', () => {
  const outcome = transcriptionFailureOutcome(new IpcError({ code: 'timeout', message: 'Slow.' }));
  expect(outcome.keepsRecording).toBe(true);
});

test('a failure that needs a new recording discards it', () => {
  const outcome = transcriptionFailureOutcome(
    new IpcError({ code: 'no_speech', message: 'Silence.' }),
  );
  expect(outcome.keepsRecording).toBe(false);
});
