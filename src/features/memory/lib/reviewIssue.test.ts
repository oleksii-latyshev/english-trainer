// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { reviewIssue } from './reviewIssue';

const none = { actionError: null, captureError: '' } as const;

describe('review issue', () => {
  it('shows nothing when nothing went wrong', () => {
    expect(reviewIssue(none)).toBeNull();
  });

  it('maps each transcription failure to its own fix', () => {
    expect(
      reviewIssue({ ...none, transcriptionFailure: { kind: 'retry', message: 'Slow.' } }),
    ).toEqual({
      message: 'Slow.',
      fix: 'transcribe-again',
    });
    expect(
      reviewIssue({ ...none, transcriptionFailure: { kind: 'record_again', message: 'Quiet.' } })
        ?.fix,
    ).toBe('record-again');
    expect(
      reviewIssue({ ...none, transcriptionFailure: { kind: 'setup', message: 'No model.' } })?.fix,
    ).toBe('open-settings');
  });

  it('turns a microphone problem into a plain retry', () => {
    expect(reviewIssue({ ...none, captureError: 'The microphone disconnected.' })).toEqual({
      message: 'The microphone disconnected.',
      fix: 'record-again',
    });
  });

  it('puts a failed save, skip or finish before any recording problem', () => {
    const recording = {
      captureError: 'Mic.',
      transcriptionFailure: { kind: 'retry', message: 'x' },
    } as const;
    expect(reviewIssue({ ...recording, actionError: 'save' })?.fix).toBe('save-again');
    expect(reviewIssue({ ...recording, actionError: 'skip' })?.fix).toBe('skip-again');
    expect(reviewIssue({ ...recording, actionError: 'finish' })?.fix).toBe('finish-again');
    expect(reviewIssue({ ...recording, actionError: 'too-long' })?.fix).toBe('record-again');
  });
});
