import { describe, expect, it } from 'bun:test';
import {
  coachPromptQuestion,
  practicePromptSequence,
  recallSessionId,
  restoredCoachAnswer,
  restoredRetryAnchor,
  sendFailure,
} from './practiceViewState';

describe('saved practice projection', () => {
  const coachSession = {
    tag: 'active',
    sessionId: 12,
    mode: 'coach',
    question: 'What changed next?',
    turnCount: 1,
    targetTurns: 4,
    retryEvidence: [],
    coachState: {
      session_id: 12,
      sequence: 1,
      answered_question: 'What did you build?',
      original_transcript: 'I built an internal dashboard.',
      feedback: { focus_feedback: [], b2_rewrite: 'I developed an internal dashboard.' },
      is_pending: true,
    },
  };

  it('restores the saved answer by session and sequence without capture identity', () => {
    const answer = restoredCoachAnswer(coachSession);
    expect(answer).toEqual({
      sessionId: 12,
      sequence: 1,
      answeredQuestion: 'What did you build?',
      originalTranscript: 'I built an internal dashboard.',
      requestId: -1,
    });
    expect(restoredRetryAnchor(answer, coachSession.coachState.feedback)?.feedback).toEqual(
      coachSession.coachState.feedback,
    );
  });

  it('keeps daily phrase recall restricted to conversation sessions', () => {
    expect(recallSessionId(coachSession)).toBeUndefined();
    expect(recallSessionId({ ...coachSession, mode: 'conversation', targetTurns: 1 })).toBe(12);
  });

  it('numbers the saved pending Coach answer, then the next prompt after Continue', () => {
    expect(practicePromptSequence(coachSession)).toBe(1);
    expect(
      practicePromptSequence({
        ...coachSession,
        coachState: { ...coachSession.coachState, is_pending: false },
      }),
    ).toBe(2);
    expect(practicePromptSequence({ ...coachSession, mode: 'conversation' })).toBe(2);
  });

  it('keeps Try Again on its saved question after Coach has continued', () => {
    const anchor = restoredCoachAnswer(coachSession);
    const continued = {
      ...coachSession,
      question: 'What changed next?',
      coachState: { ...coachSession.coachState, is_pending: false },
    };
    expect(coachPromptQuestion(anchor, anchor, continued, true)).toBe('What did you build?');
    expect(coachPromptQuestion(anchor, anchor, continued, false)).toBe('What changed next?');
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
