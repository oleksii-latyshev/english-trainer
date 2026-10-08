// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import { isCoachingEvent, isTurnCoaching } from './coachingTypes';
import { isPracticeDialogue } from './dialogueTypes';

const feedback = {
  focus_feedback: [
    {
      category: 'grammar',
      original: 'I go yesterday',
      improved: 'I went yesterday',
      explanation: 'Use the past form.',
    },
  ],
  b2_rewrite: 'I went there yesterday.',
};

describe('background coaching payloads', () => {
  it('accepts each coaching state Rust sends and rejects the rest', () => {
    expect(isTurnCoaching({ state: 'pending' })).toBe(true);
    expect(isTurnCoaching({ state: 'paused' })).toBe(true);
    expect(isTurnCoaching({ state: 'failed' })).toBe(true);
    expect(isTurnCoaching({ state: 'ready', feedback })).toBe(true);
    expect(isTurnCoaching({ state: 'ready' })).toBe(false);
    expect(isTurnCoaching({ state: 'ready', feedback: { b2_rewrite: '' } })).toBe(false);
    expect(isTurnCoaching({ state: 'queued' })).toBe(false);
    expect(isTurnCoaching(null)).toBe(false);
  });

  it('recognises the update event of a session', () => {
    expect(isCoachingEvent({ session_id: 4 })).toBe(true);
    expect(isCoachingEvent({ session_id: 0 })).toBe(false);
    expect(isCoachingEvent({ session_id: '4' })).toBe(false);
    expect(isCoachingEvent(undefined)).toBe(false);
  });

  it('wants one coaching entry per turn in a dialogue', () => {
    const dialogue = {
      session_id: 1,
      opening_question: 'How was your day?',
      turns: [{ learner: 'Fine', assistant_reply: 'Good.', assistant_question: 'Why?' }],
    };
    expect(isPracticeDialogue({ ...dialogue, coaching: [{ state: 'pending' }] })).toBe(true);
    expect(isPracticeDialogue({ ...dialogue, coaching: [] })).toBe(false);
    expect(isPracticeDialogue({ ...dialogue, coaching: [{ state: 'nope' }] })).toBe(false);
    expect(isPracticeDialogue(dialogue)).toBe(true);
  });
});
