// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type { TurnIssue } from './turnIssue';
import {
  canPressMic,
  deriveTurnState,
  describeTurn,
  evaMoodFor,
  type FlowSignals,
  type TurnSignals,
} from './turnState';

const QUIET: TurnSignals = {
  micStatus: 'ready',
  captureStatus: 'idle',
  isHeld: false,
  isTranscribing: false,
  hasTranscript: false,
  isThinking: false,
  isEvaSpeaking: false,
  issue: null,
};

const FLOW: FlowSignals = { isHandsFree: true, endPauseMs: 1500 };
const ISSUE: TurnIssue = {
  message: 'Gemini did not answer.',
  kind: 'reply',
  fixes: ['retry-send'],
};

function derive(patch: Partial<TurnSignals>) {
  return deriveTurnState({ ...QUIET, ...patch });
}

describe('deriveTurnState', () => {
  it('is idle when nothing is happening', () => {
    expect(derive({})).toEqual({ tag: 'idle' });
    expect(derive({ micStatus: 'unmanaged' })).toEqual({ tag: 'idle' });
  });

  it('tells manual listening from auto-listen and reports whether audio is flowing', () => {
    expect(derive({ captureStatus: 'recording', recordingMode: 'manual', isHeld: true })).toEqual({
      tag: 'listening',
      isLive: true,
      isHeld: true,
    });
    expect(derive({ captureStatus: 'recording', recordingMode: 'auto' }).tag).toBe('auto-listen');
    expect(derive({ captureStatus: 'requesting' })).toEqual({
      tag: 'listening',
      isLive: false,
      isHeld: false,
    });
    expect(derive({ captureStatus: 'stopping', recordingMode: 'manual' })).toMatchObject({
      isLive: false,
    });
  });

  it('shows transcribing, then review with the countdown, then thinking after the send', () => {
    expect(derive({ captureStatus: 'ready', isTranscribing: true })).toEqual({
      tag: 'transcribing',
    });
    expect(derive({ captureStatus: 'ready', hasTranscript: true })).toEqual({
      tag: 'review',
      sendingLabel: undefined,
    });
    expect(derive({ hasTranscript: true, sendingLabel: 'Sending in 2 s — edit to stop' })).toEqual({
      tag: 'review',
      sendingLabel: 'Sending in 2 s — edit to stop',
    });
    expect(derive({ hasTranscript: true, isThinking: true })).toEqual({ tag: 'thinking' });
  });

  it('shows Eva speaking after the reply arrived', () => {
    expect(derive({ isEvaSpeaking: true })).toEqual({ tag: 'speaking' });
    expect(derive({ isEvaSpeaking: true, isThinking: true })).toEqual({ tag: 'speaking' });
  });

  it('shows an error only once nothing else is in progress, keeping the draft reachable', () => {
    expect(derive({ issue: ISSUE, hasTranscript: true })).toEqual({ tag: 'error', issue: ISSUE });
    expect(derive({ issue: ISSUE, isThinking: true })).toEqual({ tag: 'thinking' });
    expect(derive({ issue: ISSUE, captureStatus: 'recording', recordingMode: 'manual' }).tag).toBe(
      'listening',
    );
  });

  it('a paused microphone wins over everything', () => {
    expect(derive({ micStatus: 'paused', issue: ISSUE, isEvaSpeaking: true })).toEqual({
      tag: 'paused',
    });
  });
});

describe('canPressMic', () => {
  it('follows the composer rules: live listening, paused and free states accept a press', () => {
    expect(canPressMic({ tag: 'idle' }, false)).toBe(true);
    expect(canPressMic({ tag: 'idle' }, true)).toBe(false);
    expect(canPressMic({ tag: 'speaking' }, false)).toBe(true);
    expect(canPressMic({ tag: 'listening', isLive: true, isHeld: false }, true)).toBe(true);
    expect(canPressMic({ tag: 'listening', isLive: false, isHeld: false }, false)).toBe(false);
    expect(canPressMic({ tag: 'transcribing' }, false)).toBe(false);
    expect(canPressMic({ tag: 'thinking' }, false)).toBe(true);
    expect(canPressMic({ tag: 'thinking' }, true)).toBe(false);
    expect(canPressMic({ tag: 'paused' }, true)).toBe(true);
  });
});

describe('describeTurn', () => {
  it('keeps the voice visual, the label and the microphone control in agreement', () => {
    const listening = describeTurn({ tag: 'listening', isLive: true, isHeld: false }, FLOW);
    expect(listening).toMatchObject({ mood: 'listening', micVariant: 'live', micIcon: 'stop' });
    expect(listening.stageHint).toContain('1.5 s');

    expect(describeTurn({ tag: 'transcribing' }, FLOW)).toMatchObject({
      mood: 'processing',
      micTitle: 'Transcribing…',
    });
    expect(describeTurn({ tag: 'thinking' }, FLOW)).toMatchObject({
      mood: 'thinking',
      actor: 'eva',
    });
    expect(describeTurn({ tag: 'speaking' }, FLOW)).toMatchObject({ mood: 'speaking' });
    expect(describeTurn({ tag: 'paused' }, FLOW)).toMatchObject({
      mood: 'asleep',
      micIcon: 'resume',
    });
    expect(describeTurn({ tag: 'error', issue: ISSUE }, FLOW).mood).toBe('concerned');
  });

  it('words the auto-listen cue and the hands-free hint', () => {
    const auto = describeTurn({ tag: 'auto-listen', isLive: true, isHeld: false }, FLOW);
    expect(auto.stageHint).toContain('Esc');
    expect(auto.stageTitle).toBe('Listening…');
    const manual = describeTurn(
      { tag: 'listening', isLive: true, isHeld: false },
      {
        isHandsFree: false,
        endPauseMs: 1500,
      },
    );
    expect(manual.stageHint).toBe('Speak naturally, then press stop.');
    expect(manual.micHint).toBe('Press to finish');
  });

  it('teaches the keyboard in the idle and speaking copy', () => {
    const idle = describeTurn({ tag: 'idle' }, FLOW);
    expect(idle.stageHint).toBe('Press the mic or hold Space to answer.');
    expect(idle.micHint).toBe('or hold Space');
    expect(describeTurn({ tag: 'speaking' }, FLOW).stageHint).toBe(
      'Press the mic or Esc to interrupt.',
    );
  });

  it('words a failed reply as no reply yet and keeps other problems accurate', () => {
    const reply = describeTurn(
      {
        tag: 'error',
        issue: { message: 'x', kind: 'reply', fixes: ['switch-to-apple', 'retry-send'] },
      },
      FLOW,
    );
    expect(reply).toMatchObject({
      stageTitle: 'No reply yet',
      micTitle: 'Eva couldn’t answer',
      micHint: 'Try again or switch model',
    });
    const retryOnly = describeTurn({ tag: 'error', issue: ISSUE }, FLOW);
    expect(retryOnly.micHint).toBe('Try again in a moment');
    const mic = describeTurn(
      { tag: 'error', issue: { message: 'x', kind: 'microphone', fixes: ['choose-microphone'] } },
      FLOW,
    );
    expect(mic.stageTitle).toBe('Something went wrong');
  });

  it('shows the countdown seconds in the review title', () => {
    const review = describeTurn(
      { tag: 'review', sendingLabel: 'Sending in 2 s — edit to stop' },
      FLOW,
    );
    expect(review.micTitle).toBe('Sending in 2 s');
    expect(describeTurn({ tag: 'review' }, FLOW).micTitle).toBe('Ready to send');
  });
});

describe('evaMoodFor', () => {
  const none = { isPhraseSaved: false, isHelpOpen: false };

  it('follows the turn', () => {
    expect(evaMoodFor({ tag: 'idle' }, FLOW, none)).toBe('idle');
    expect(evaMoodFor({ tag: 'paused' }, FLOW, none)).toBe('asleep');
  });

  it('is happy after a saved phrase and curious while help is open, only when idle', () => {
    expect(evaMoodFor({ tag: 'idle' }, FLOW, { ...none, isPhraseSaved: true })).toBe('happy');
    expect(evaMoodFor({ tag: 'idle' }, FLOW, { ...none, isHelpOpen: true })).toBe('curious');
    expect(evaMoodFor({ tag: 'idle' }, FLOW, { isPhraseSaved: true, isHelpOpen: true })).toBe(
      'happy',
    );
    expect(evaMoodFor({ tag: 'thinking' }, FLOW, { ...none, isPhraseSaved: true })).toBe(
      'thinking',
    );
  });
});
