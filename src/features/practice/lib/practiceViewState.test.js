import { describe, expect, it } from 'bun:test';
import {
  canSendAnswer,
  matchingSentAnswer,
  recallSessionId,
  sendFailure,
} from './practiceViewState';

describe('saved practice projection', () => {
  const session = {
    tag: 'active',
    sessionId: 12,
    question: 'What changed next?',
    turnCount: 1,
    targetTurns: 8,
    retryEvidence: [],
  };

  it('offers daily phrase recall once the speaking goal is reached', () => {
    expect(recallSessionId(session)).toBeUndefined();
    expect(recallSessionId({ ...session, turnCount: 8 })).toBe(12);
    expect(recallSessionId(undefined)).toBeUndefined();
  });

  it('keeps a sent answer only for the capture it was sent from', () => {
    const answer = { sessionId: 12, sequence: 1, originalTranscript: 'Hello', requestId: 3 };
    expect(matchingSentAnswer(answer, 3, 'Hello')).toBe(answer);
    expect(matchingSentAnswer(answer, 4, 'Hello')).toBeNull();
    expect(matchingSentAnswer(answer, 3, 'Other')).toBeNull();
    expect(matchingSentAnswer(null, 3, 'Hello')).toBeNull();
  });
});

describe('canSendAnswer', () => {
  const ready = {
    practiceTag: 'active',
    isBusy: false,
    canChangeSession: true,
    isPending: false,
    isRetrying: false,
    isRecalling: false,
  };

  it('sends only when nothing else is going on', () => {
    expect(canSendAnswer(ready)).toBe(true);
    for (const blocker of ['isPending', 'isRetrying', 'isRecalling', 'isBusy']) {
      expect(canSendAnswer({ ...ready, [blocker]: true })).toBe(false);
    }
    expect(canSendAnswer({ ...ready, practiceTag: 'waiting' })).toBe(false);
    expect(canSendAnswer({ ...ready, canChangeSession: false })).toBe(false);
  });
});

describe('sendFailure', () => {
  it('is empty unless the send failed', () => {
    expect(sendFailure({ tag: 'idle' })).toBeUndefined();
  });

  it('tells a missing setup from a model that did not answer', () => {
    const failure = (code) => sendFailure({ tag: 'error', code, message: 'x' });
    expect(failure('unauthorized')).toMatchObject({ needsSetup: true, isUnresponsive: false });
    expect(failure('timeout')).toMatchObject({ needsSetup: false, isUnresponsive: true });
    expect(failure('rate_limited').isUnresponsive).toBe(true);
    expect(failure('busy')).toMatchObject({ needsSetup: false, isUnresponsive: false });
  });
});
