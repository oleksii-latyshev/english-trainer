// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { clearSessionDraft, getSessionDraft, setSessionDraft } from './draftStore';

describe('draftStore', () => {
  it('stores and retrieves in-memory session draft', () => {
    setSessionDraft(101, {
      text: 'My draft answer',
      recognizedText: 'My draft answer',
      isNewVoice: true,
    });

    const retrieved = getSessionDraft(101);
    expect(retrieved).toBeDefined();
    expect(retrieved?.text).toBe('My draft answer');
    expect(retrieved?.isNewVoice).toBe(true);
  });

  it('restores the edited draft and its capture identity when revisiting the same request', () => {
    setSessionDraft(104, {
      text: 'Edited words',
      recognizedText: 'Recognized words',
      isNewVoice: true,
      requestId: 7,
    });

    expect(getSessionDraft(104)).toEqual({
      text: 'Edited words',
      recognizedText: 'Recognized words',
      isNewVoice: true,
      requestId: 7,
    });
  });

  it('resets old session drafts when a different session draft is set', () => {
    setSessionDraft(101, {
      text: 'Session 101 draft',
      isNewVoice: false,
    });
    setSessionDraft(102, {
      text: 'Session 102 draft',
      isNewVoice: false,
    });

    expect(getSessionDraft(101)).toBeUndefined();
    expect(getSessionDraft(102)?.text).toBe('Session 102 draft');
  });

  it('clears draft explicitly', () => {
    setSessionDraft(103, {
      text: 'Temporary draft',
      isNewVoice: false,
    });
    clearSessionDraft(103);
    expect(getSessionDraft(103)).toBeUndefined();
  });
});
