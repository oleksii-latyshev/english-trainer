import { describe, expect, it } from 'bun:test';
import { recordButtonLabel, recordingLabel, transcribeButtonLabel } from './index';

describe('recordingLabel', () => {
  it('counts the time as minutes and seconds', () => {
    expect(recordingLabel('recording', 65_000, 0)).toBe('Recording · 1:05');
    expect(recordingLabel('ready', 0, 9_400)).toBe('Ready to listen · 0:09');
  });

  it('names every other state', () => {
    expect(recordingLabel('idle', 0, 0)).toBe('Microphone ready when you are');
    expect(recordingLabel('requesting', 0, 0)).toBe('Waiting for microphone permission…');
    expect(recordingLabel('stopping', 0, 0)).toBe('Finishing recording…');
    expect(recordingLabel('error', 0, 0)).toBe('Ready to try again');
  });
});

describe('transcribeButtonLabel', () => {
  it('says what it is doing and how a failure can be retried', () => {
    expect(transcribeButtonLabel(true, undefined)).toBe('Transcribing locally…');
    expect(transcribeButtonLabel(false, { kind: 'setup', message: 'x' })).toBe('Retry after setup');
    expect(transcribeButtonLabel(false, { kind: 'retry', message: 'x' })).toBe(
      'Retry transcription',
    );
    expect(transcribeButtonLabel(false, undefined)).toBe('Transcribe');
  });
});

describe('recordButtonLabel', () => {
  it('offers a fresh take once there is something recorded', () => {
    expect(recordButtonLabel('idle', false)).toBe('Start recording');
    expect(recordButtonLabel('ready', false)).toBe('Record again');
    expect(recordButtonLabel('idle', true)).toBe('Record again');
    expect(recordButtonLabel('error', false)).toBe('Try recording again');
  });
});
