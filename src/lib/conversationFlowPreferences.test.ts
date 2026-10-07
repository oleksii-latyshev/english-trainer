// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_CONVERSATION_FLOW,
  effectiveAutoSendDelayMs,
  getConversationFlow,
  parseConversationFlow,
  setConversationFlow,
  subscribeConversationFlow,
} from './conversationFlowPreferences';

describe('conversation flow preferences', () => {
  it('uses defaults for missing, malformed or non-object values', () => {
    for (const value of [null, undefined, 3, [], 'not json', '[1]', '"x"']) {
      expect(parseConversationFlow(value)).toEqual(DEFAULT_CONVERSATION_FLOW);
    }
    expect(DEFAULT_CONVERSATION_FLOW).toMatchObject({
      autoListen: true,
      handsFree: true,
      endPauseMs: 1500,
      autoSendDelayMs: 2000,
    });
  });

  it('keeps valid fields and replaces invalid ones individually', () => {
    const parsed = parseConversationFlow(
      JSON.stringify({
        autoListen: false,
        handsFree: 'yes',
        endPauseMs: 2000,
        autoSendDelayMs: 'x',
      }),
    );
    expect(parsed.autoListen).toBe(false);
    expect(parsed.handsFree).toBe(true);
    expect(parsed.endPauseMs).toBe(2000);
    expect(parsed.autoSendDelayMs).toBe(2000);
  });

  it('clamps and rounds durations into their ranges', () => {
    expect(parseConversationFlow({ endPauseMs: 10 }).endPauseMs).toBe(1000);
    expect(parseConversationFlow({ endPauseMs: 99_999 }).endPauseMs).toBe(3000);
    expect(parseConversationFlow({ endPauseMs: 1234.6 }).endPauseMs).toBe(1235);
    expect(parseConversationFlow({ autoSendDelayMs: -5 }).autoSendDelayMs).toBe(0);
    expect(parseConversationFlow({ autoSendDelayMs: 9000 }).autoSendDelayMs).toBe(5000);
    expect(parseConversationFlow({ endPauseMs: Number.NaN }).endPauseMs).toBe(1500);
  });

  it('applies updates, validates them and notifies subscribers', () => {
    let calls = 0;
    const unsubscribe = subscribeConversationFlow(() => {
      calls += 1;
    });
    setConversationFlow({ autoListen: false, endPauseMs: 100 });
    expect(getConversationFlow().autoListen).toBe(false);
    expect(getConversationFlow().endPauseMs).toBe(1000);
    expect(calls).toBe(1);
    unsubscribe();
    setConversationFlow({ autoListen: true, endPauseMs: 1500 });
    expect(calls).toBe(1);
  });
});

describe('effectiveAutoSendDelayMs', () => {
  it('fully hands-free conversation sends at once', () => {
    expect(effectiveAutoSendDelayMs(DEFAULT_CONVERSATION_FLOW)).toBe(0);
  });

  it('the edit window applies when auto-listen or hands-free is off', () => {
    expect(effectiveAutoSendDelayMs({ ...DEFAULT_CONVERSATION_FLOW, autoListen: false })).toBe(
      2000,
    );
    expect(effectiveAutoSendDelayMs({ ...DEFAULT_CONVERSATION_FLOW, handsFree: false })).toBe(2000);
  });
});
