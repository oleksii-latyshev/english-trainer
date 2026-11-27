import { describe, expect, it } from 'bun:test';
import type { ReviewedConversation } from '../../types';
import { debriefCards } from '.';

const conversation: ReviewedConversation = {
  session_id: 7,
  opening_question: 'What did you do?',
  turns: [
    {
      learner: 'I go home.',
      assistant_reply: 'Nice.',
      assistant_question: 'Why?',
      answered_by: null,
    },
    { learner: '  ', assistant_reply: '', assistant_question: 'And then?', answered_by: null },
    {
      learner: 'To rest.',
      assistant_reply: 'Good.',
      assistant_question: 'Where?',
      answered_by: null,
    },
  ],
  input_sources: [],
  reply_times_ms: [],
  answer_durations_ms: [],
  help_used: [],
  coaching: [{ state: 'pending' }, { state: 'failed' }, { state: 'paused' }],
  debrief_words: [
    { sequence: 3, phrase: 'unwind', meaning: 'relax', example: 'I unwind at home.' },
  ],
  debrief_wins: [{ sequence: 3, phrase: 'look into' }],
  habits: [],
  focus_rule: null,
};

describe('debriefCards', () => {
  it('makes one card per spoken answer with the question Eva asked before it', () => {
    const cards = debriefCards(conversation);

    expect(cards.map((card) => card.target)).toEqual([
      { sessionId: 7, sequence: 1 },
      { sessionId: 7, sequence: 3 },
    ]);
    expect(cards.map((card) => card.question)).toEqual(['What did you do?', 'And then?']);
    expect(cards.map((card) => card.said)).toEqual(['I go home.', 'To rest.']);
  });

  it('keeps each answer state and only the words offered for that answer', () => {
    const [first, second] = debriefCards(conversation);

    expect(first?.coaching).toEqual({ state: 'pending' });
    expect(first?.offered).toEqual([]);
    expect(second?.coaching).toEqual({ state: 'paused' });
    expect(second?.offered.map((word) => word.phrase)).toEqual(['unwind']);
  });

  it('marks only the taken words used on their own in that answer', () => {
    const [first, second] = debriefCards(conversation);

    expect(first?.wins).toEqual([]);
    expect(second?.wins).toEqual(['look into']);
  });
});
