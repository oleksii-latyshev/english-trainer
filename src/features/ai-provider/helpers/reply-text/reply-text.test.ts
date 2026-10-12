import { expect, it } from 'bun:test';
import type { ConversationTurn } from '@/core/ipc';
import { replyText } from '.';

const TURN: ConversationTurn = {
  spoken_reply: 'That sounds fun.',
  question: 'What did you build?',
  session_phase: 'warmup',
  is_complete: false,
};

it('puts the question on its own paragraph after the reply', () => {
  expect(replyText(TURN)).toBe('That sounds fun.\n\nWhat did you build?');
});

it('is just the reply when there is no question', () => {
  expect(replyText({ ...TURN, question: null })).toBe('That sounds fun.');
});
