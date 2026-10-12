import { describe, expect, it } from 'bun:test';
import { DEFAULT_CONVERSATION_FLOW } from '../../conversation-flow';
import { decodeConversationFlow } from './index';

describe('conversation flow schema', () => {
  it('uses the defaults for missing, malformed or non-object values', () => {
    for (const value of [null, undefined, 3, [], 'x', {}]) {
      expect(decodeConversationFlow(value)).toEqual(DEFAULT_CONVERSATION_FLOW);
    }
  });

  it('keeps valid fields and replaces invalid ones individually', () => {
    const decoded = decodeConversationFlow({
      autoListen: false,
      handsFree: 'yes',
      endPauseMs: 2000,
      autoSendDelayMs: 'x',
      voiceInterrupt: true,
    });
    expect(decoded.autoListen).toBe(false);
    expect(decoded.handsFree).toBe(true);
    expect(decoded.endPauseMs).toBe(2000);
    expect(decoded.autoSendDelayMs).toBe(2000);
    expect(decoded.voiceInterrupt).toBe(true);
  });

  it('fills fields a legacy value never stored', () => {
    const decoded = decodeConversationFlow({ autoListen: false, handsFree: false });
    expect(decoded.voiceInterrupt).toBe(false);
    expect(decoded.autoSendVoice).toBe(true);
  });

  it('clamps and rounds durations into their ranges', () => {
    expect(decodeConversationFlow({ endPauseMs: 10 }).endPauseMs).toBe(1000);
    expect(decodeConversationFlow({ endPauseMs: 99_999 }).endPauseMs).toBe(3000);
    expect(decodeConversationFlow({ endPauseMs: 1234.6 }).endPauseMs).toBe(1235);
    expect(decodeConversationFlow({ autoSendDelayMs: -5 }).autoSendDelayMs).toBe(0);
    expect(decodeConversationFlow({ autoSendDelayMs: 9000 }).autoSendDelayMs).toBe(5000);
    expect(decodeConversationFlow({ endPauseMs: Number.NaN }).endPauseMs).toBe(1500);
  });
});
