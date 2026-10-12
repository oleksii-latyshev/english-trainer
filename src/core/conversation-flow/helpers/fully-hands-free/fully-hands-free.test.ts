import { describe, expect, it } from 'bun:test';
import { DEFAULT_CONVERSATION_FLOW } from '../../conversation-flow';
import { effectiveAutoSendDelayMs, isFullyHandsFree } from './index';

describe('fully hands-free', () => {
  it('needs both hands-free and auto-listen', () => {
    expect(isFullyHandsFree(DEFAULT_CONVERSATION_FLOW)).toBe(true);
    expect(isFullyHandsFree({ ...DEFAULT_CONVERSATION_FLOW, handsFree: false })).toBe(false);
    expect(isFullyHandsFree({ ...DEFAULT_CONVERSATION_FLOW, autoListen: false })).toBe(false);
  });

  it('sends at once only when fully hands-free', () => {
    expect(effectiveAutoSendDelayMs(DEFAULT_CONVERSATION_FLOW)).toBe(0);
    expect(effectiveAutoSendDelayMs({ ...DEFAULT_CONVERSATION_FLOW, autoListen: false })).toBe(
      DEFAULT_CONVERSATION_FLOW.autoSendDelayMs,
    );
  });
});
