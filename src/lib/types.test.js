import { describe, expect, it } from 'bun:test';
import { isConversationTurn, isProviderError } from './types';

describe('conversation IPC payloads', () => {
  it('accepts a typed spoken turn and rejects the CLI wrapper', () => {
    const turn = {
      spoken_reply: 'That sounds lovely.',
      question: 'What did you enjoy most?',
      session_phase: 'active',
      is_complete: false,
    };
    expect(isConversationTurn(turn)).toBe(true);
    expect(isConversationTurn({ status: 'SUCCESS', structured_output: turn })).toBe(false);
    expect(isConversationTurn({ ...turn, question: 3 })).toBe(false);
  });

  it('accepts known provider errors only', () => {
    expect(isProviderError({ code: 'timeout', message: 'Try again.' })).toBe(true);
    expect(isProviderError({ code: 'unexpected', message: 'Internal data' })).toBe(false);
    expect(isProviderError('unavailable')).toBe(false);
  });
});
