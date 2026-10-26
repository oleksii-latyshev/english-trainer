import { describe, expect, test } from 'bun:test';
import type { WriteSpeakDialogue } from '../../types';
import {
  coachingStatusMessage,
  feedbackSummary,
  hasSavedAnswers,
  questionForSequence,
  sequencesBetween,
} from './index';

function aDialogue(overrides: Partial<WriteSpeakDialogue> = {}): WriteSpeakDialogue {
  return {
    session_id: 1,
    opening_question: 'What tool do you use?',
    turns: [
      {
        learner: 'A notebook.',
        assistant_reply: '',
        assistant_question: 'Why?',
        answered_by: null,
      },
      { learner: '', assistant_reply: '', assistant_question: 'How long?', answered_by: null },
    ],
    input_sources: [],
    reply_times_ms: [],
    answer_durations_ms: [],
    help_used: [],
    coaching: [{ state: 'pending' }, { state: 'paused' }],
    ...overrides,
  };
}

describe('sequencesBetween', () => {
  test('lists an inclusive range', () => {
    expect(sequencesBetween(2, 4)).toEqual([2, 3, 4]);
  });

  test('is empty when the end is before the start', () => {
    expect(sequencesBetween(3, 2)).toEqual([]);
  });
});

describe('questionForSequence', () => {
  test('uses the opening question for the first answer and for the first spoken answer', () => {
    const dialogue = aDialogue();
    expect(questionForSequence(dialogue, 1, 1)).toBe('What tool do you use?');
    expect(questionForSequence(dialogue, 2, 1)).toBe('What tool do you use?');
  });

  test('uses the previous follow-up question otherwise', () => {
    expect(questionForSequence(aDialogue(), 2, 2)).toBe('Why?');
  });

  test('is empty while the dialogue loads', () => {
    expect(questionForSequence(null, 1, 1)).toBe('');
  });
});

describe('feedbackSummary', () => {
  test('counts each coaching state and treats missing ones as unavailable', () => {
    expect(feedbackSummary(aDialogue(), [1, 2, 3])).toBe(
      '3 answers · 1 pending · 1 paused · 1 unavailable',
    );
  });

  test('shows only the states that are present and pluralizes the count', () => {
    expect(feedbackSummary(aDialogue(), [1])).toBe('1 answer · 1 pending');
  });

  test('says feedback is loading without a dialogue', () => {
    expect(feedbackSummary(null, [1])).toBe('Feedback status is loading.');
  });
});

describe('hasSavedAnswers', () => {
  test('ignores blank answers', () => {
    expect(hasSavedAnswers(aDialogue(), [2])).toBe(false);
    expect(hasSavedAnswers(aDialogue(), [1, 2])).toBe(true);
  });
});

describe('coachingStatusMessage', () => {
  test('explains a missing, pending, paused and failed state', () => {
    expect(coachingStatusMessage(undefined)).toBe('Coaching status is unavailable.');
    expect(coachingStatusMessage({ state: 'pending' })).toBe('Eva is still checking this answer.');
    expect(coachingStatusMessage({ state: 'paused' })).toBe(
      'Coaching is paused. You can continue.',
    );
  });
});
