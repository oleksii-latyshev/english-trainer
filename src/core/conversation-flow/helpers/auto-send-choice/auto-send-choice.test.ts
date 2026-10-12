import { describe, expect, it } from 'bun:test';
import { DEFAULT_CONVERSATION_FLOW } from '../../conversation-flow';
import { autoSendChoice, autoSendPatch } from './index';

describe('auto-send choice', () => {
  it('reads off, a delay Settings offers, or nothing for another delay', () => {
    expect(autoSendChoice({ ...DEFAULT_CONVERSATION_FLOW, autoSendVoice: false })).toBe('off');
    expect(autoSendChoice({ ...DEFAULT_CONVERSATION_FLOW, autoSendDelayMs: 3000 })).toBe(3000);
    expect(autoSendChoice({ ...DEFAULT_CONVERSATION_FLOW, autoSendDelayMs: 4000 })).toBeUndefined();
  });

  it('turns a choice into the stored fields', () => {
    expect(autoSendPatch('off')).toEqual({ autoSendVoice: false });
    expect(autoSendPatch(1000)).toEqual({ autoSendVoice: true, autoSendDelayMs: 1000 });
  });
});
