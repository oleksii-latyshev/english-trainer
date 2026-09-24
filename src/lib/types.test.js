import { describe, expect, it } from 'bun:test';
import {
  isConversationTurn,
  isFinishedPracticeSession,
  isPracticeSession,
  isProviderError,
} from './types';

describe('conversation IPC payloads', () => {
  it('accepts a typed spoken turn and rejects the CLI wrapper', () => {
    const turn = {
      spoken_reply: 'That sounds lovely.',
      question: 'What did you enjoy most?',
      session_phase: 'active',
      is_complete: false,
    };
    expect(isConversationTurn(turn)).toBe(true);
    expect(isConversationTurn({ ...turn, provider_latency_ms: 1200 })).toBe(true);
    expect(isConversationTurn({ ...turn, provider_latency_ms: -1 })).toBe(false);
    expect(isConversationTurn({ status: 'SUCCESS', structured_output: turn })).toBe(false);
    expect(isConversationTurn({ ...turn, question: 3 })).toBe(false);
  });

  it('accepts known provider errors only', () => {
    expect(isProviderError({ code: 'timeout', message: 'Try again.' })).toBe(true);
    expect(isProviderError({ code: 'invalid_session', message: 'Start a new session.' })).toBe(
      true,
    );
    expect(isProviderError({ code: 'database_error', message: 'Please retry.' })).toBe(true);
    expect(isProviderError({ code: 'unexpected', message: 'Internal data' })).toBe(false);
    expect(isProviderError('unavailable')).toBe(false);
  });

  it('requires a valid practice session identifier and opening question', () => {
    expect(
      isPracticeSession({ session_id: 1, opening_question: 'How was your day?', turn_count: 2 }),
    ).toBe(true);
    expect(
      isPracticeSession({ session_id: 0, opening_question: 'How was your day?', turn_count: 0 }),
    ).toBe(false);
    expect(isPracticeSession({ session_id: 1, opening_question: '', turn_count: 0 })).toBe(false);
    expect(isFinishedPracticeSession({ session_id: 1, finished: true })).toBe(true);
    expect(isFinishedPracticeSession({ session_id: 1, finished: false })).toBe(false);
  });
});
