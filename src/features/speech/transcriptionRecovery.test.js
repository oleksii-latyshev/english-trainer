import { describe, expect, it } from 'bun:test';
import { transcriptionRecovery } from './transcriptionRecovery';

describe('transcription recovery', () => {
  it('requires a new recording when the captured audio cannot be transcribed', () => {
    expect(transcriptionRecovery({ code: 'no_speech', message: 'Speak again.' })).toEqual({
      kind: 'record_again',
      message: 'Speak again.',
    });
    expect(transcriptionRecovery({ code: 'invalid_audio', message: 'Record again.' }).kind).toBe(
      'record_again',
    );
  });

  it('keeps the recording available while local Whisper is being configured', () => {
    expect(transcriptionRecovery({ code: 'model_missing', message: 'Install the model.' })).toEqual(
      {
        kind: 'setup',
        message: 'Install the model.',
      },
    );
    expect(
      transcriptionRecovery({ code: 'engine_missing', message: 'Install Whisper.' }).kind,
    ).toBe('setup');
  });

  it('retries transient failures without trusting untyped error payloads', () => {
    expect(transcriptionRecovery({ code: 'timeout', message: 'Try again.' }).kind).toBe('retry');
    expect(transcriptionRecovery('Whisper failed')).toEqual({
      kind: 'retry',
      message: 'Local transcription failed unexpectedly. Please retry.',
    });
    expect(transcriptionRecovery({ code: 'unknown', message: 'Internal path' }).kind).toBe('retry');
  });
});
