import { expect, test } from 'bun:test';
import { IpcError } from '@/core/ipc';
import { transcriptionRecovery } from '.';

test('silence asks the learner to record again', () => {
  expect(
    transcriptionRecovery(new IpcError({ code: 'no_speech', message: 'Speak again.' })),
  ).toEqual({ kind: 'record_again', message: 'Speak again.' });
});

test('unusable audio asks the learner to record again', () => {
  expect(
    transcriptionRecovery(new IpcError({ code: 'invalid_audio', message: 'Record again.' })).kind,
  ).toBe('record_again');
});

test('a missing model or engine needs setup', () => {
  expect(
    transcriptionRecovery(new IpcError({ code: 'model_missing', message: 'Install the model.' })),
  ).toEqual({ kind: 'setup', message: 'Install the model.' });
  expect(
    transcriptionRecovery(new IpcError({ code: 'engine_missing', message: 'Install Whisper.' }))
      .kind,
  ).toBe('setup');
});

test('other failures can be retried with the message Rust gave', () => {
  expect(transcriptionRecovery(new IpcError({ code: 'timeout', message: 'Too slow.' }))).toEqual({
    kind: 'retry',
    message: 'Too slow.',
  });
});

test('an unknown failure gets a generic retry message', () => {
  expect(transcriptionRecovery(new Error('boom')).kind).toBe('retry');
});
