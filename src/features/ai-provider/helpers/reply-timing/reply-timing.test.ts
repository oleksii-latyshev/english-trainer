import { expect, it } from 'bun:test';
import type { ConversationTurn } from '@/core/ipc';
import { formatSeconds, replyTiming } from '.';

const TURN: ConversationTurn = {
  spoken_reply: 'Nice.',
  question: null,
  session_phase: 'warmup',
  is_complete: false,
};

it('formats milliseconds as seconds with the requested decimals', () => {
  expect(formatSeconds(620, 2)).toBe('0.62 s');
  expect(formatSeconds(1400, 1)).toBe('1.4 s');
});

it('reports first words and the full reply from the provider timings', () => {
  expect(replyTiming({ ...TURN, first_token_ms: 620, provider_latency_ms: 1400 })).toEqual({
    firstWords: '0.62 s',
    fullReply: '1.4 s',
  });
});

it('uses the full latency for first words when no first token time exists', () => {
  expect(replyTiming({ ...TURN, provider_latency_ms: 900 })).toEqual({
    firstWords: '0.90 s',
    fullReply: '0.9 s',
  });
});

it('reports nothing when the provider sent no latency', () => {
  expect(replyTiming(TURN)).toBeNull();
});
