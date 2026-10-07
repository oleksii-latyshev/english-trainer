// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import { isPracticeDialogue, isPracticeDialogueTurn } from './dialogueTypes';

describe('dialogueTypes', () => {
  it('validates a valid practice dialogue turn', () => {
    expect(
      isPracticeDialogueTurn({
        learner: 'Hello',
        assistant_reply: 'Hi there',
        assistant_question: 'How are you?',
      }),
    ).toBe(true);
  });

  it('accepts a null or valid origin and rejects a malformed one', () => {
    const turn = { learner: 'Hello', assistant_reply: 'Hi', assistant_question: 'Why?' };
    const answeredBy = { provider: 'gemini', model: 'gemini-3.5-flash-lite', is_backup: false };
    expect(isPracticeDialogueTurn({ ...turn, answered_by: null })).toBe(true);
    expect(isPracticeDialogueTurn({ ...turn, answered_by: answeredBy })).toBe(true);
    expect(isPracticeDialogueTurn({ ...turn, answered_by: { provider: 'gemini' } })).toBe(false);
  });

  it('rejects an invalid practice dialogue turn with missing fields', () => {
    expect(
      isPracticeDialogueTurn({
        learner: 'Hello',
        assistant_reply: 'Hi there',
      }),
    ).toBe(false);
  });

  it('validates a well-formed practice dialogue structure', () => {
    const payload = {
      session_id: 42,
      opening_question: 'Tell me about yourself.',
      turns: [
        {
          learner: 'I am a designer.',
          assistant_reply: 'Nice to meet you!',
          assistant_question: 'What do you design?',
        },
        {
          learner: 'Web apps.',
          assistant_reply: '',
          assistant_question: '',
        },
      ],
    };
    expect(isPracticeDialogue(payload)).toBe(true);
  });

  it('rejects dialogue when session_id is non-positive or non-integer', () => {
    expect(
      isPracticeDialogue({
        session_id: 0,
        opening_question: 'Hi',
        turns: [],
      }),
    ).toBe(false);

    expect(
      isPracticeDialogue({
        session_id: 1.5,
        opening_question: 'Hi',
        turns: [],
      }),
    ).toBe(false);
  });

  it('rejects dialogue when turns are malformed', () => {
    expect(
      isPracticeDialogue({
        session_id: 1,
        opening_question: 'Hi',
        turns: [{ invalid: true }],
      }),
    ).toBe(false);
  });
});

it('validates persisted input provenance without accepting unknown sources', () => {
  const base = {
    session_id: 1,
    opening_question: 'Question?',
    turns: [{ learner: 'Answer', assistant_reply: 'Reply', assistant_question: 'Next?' }],
  };
  expect(isPracticeDialogue({ ...base, input_sources: ['text'] })).toBe(true);
  expect(isPracticeDialogue({ ...base, input_sources: ['edited'] })).toBe(true);
  expect(isPracticeDialogue({ ...base, input_sources: ['unknown'] })).toBe(false);
  expect(isPracticeDialogue({ ...base, input_sources: [] })).toBe(false);
});
