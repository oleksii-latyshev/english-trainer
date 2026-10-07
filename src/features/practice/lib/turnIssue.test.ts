// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { turnIssue } from './turnIssue';

describe('turnIssue', () => {
  const base = {
    captureError: '',
    micStatus: 'ready',
    micError: '',
    canSwitchToApple: true,
  } as const;
  const slow = { message: 'Slow.', needsSetup: false, isUnresponsive: true };

  it('is empty when nothing is wrong', () => {
    expect(turnIssue(base)).toBeNull();
  });

  it('offers a retry for a failed send, or Settings when only setup helps', () => {
    expect(turnIssue({ ...base, sendError: { ...slow, isUnresponsive: false } })).toEqual({
      message: 'Slow.',
      kind: 'reply',
      fixes: ['retry-send'],
    });
    expect(
      turnIssue({
        ...base,
        sendError: { message: 'No key.', needsSetup: true, isUnresponsive: false },
      })?.fixes,
    ).toEqual(['open-settings']);
  });

  it('adds switching to Apple when the model stalled and another one is available', () => {
    expect(turnIssue({ ...base, sendError: slow })?.fixes).toEqual([
      'switch-to-apple',
      'retry-send',
    ]);
    expect(turnIssue({ ...base, canSwitchToApple: false, sendError: slow })?.fixes).toEqual([
      'retry-send',
    ]);
  });

  it('maps each transcription recovery to its own fix', () => {
    const fixFor = (kind: 'setup' | 'record_again' | 'retry') =>
      turnIssue({ ...base, transcriptionFailure: { kind, message: 'x' } })?.fixes;
    expect(fixFor('setup')).toEqual(['open-settings']);
    expect(fixFor('record_again')).toEqual(['record-again']);
    expect(fixFor('retry')).toEqual(['transcribe-again']);
  });

  it('sends microphone problems to the microphone choice first', () => {
    expect(turnIssue({ ...base, captureError: 'Permission denied.' })).toEqual({
      message: 'Permission denied.',
      kind: 'microphone',
      fixes: ['choose-microphone', 'record-again'],
    });
    expect(turnIssue({ ...base, micStatus: 'error', micError: 'Mic unplugged.' })).toEqual({
      message: 'Mic unplugged.',
      kind: 'microphone',
      fixes: ['choose-microphone', 'resume-mic'],
    });
    expect(turnIssue({ ...base, micStatus: 'error' })?.message).toBe(
      'The microphone is unavailable.',
    );
  });

  it('puts a failed send ahead of an older transcription failure', () => {
    const issue = turnIssue({
      ...base,
      sendError: { message: 'Send failed.', needsSetup: false, isUnresponsive: false },
      transcriptionFailure: { kind: 'retry', message: 'Old.' },
    });
    expect(issue?.message).toBe('Send failed.');
  });
});
