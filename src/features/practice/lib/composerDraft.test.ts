// @ts-expect-error Bun provides this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { canEditDraft, canOfferTypeInstead } from './composerDraft';

describe('composer draft access', () => {
  it('keeps typed fallback available when voice capture is paused or unavailable', () => {
    const micIssue = { message: 'Microphone unavailable.', kind: 'microphone' as const, fixes: [] };
    expect(canOfferTypeInstead({ tag: 'error', issue: micIssue }, false, 'voice')).toBe(true);
    expect(canOfferTypeInstead({ tag: 'paused' }, false, 'voice')).toBe(true);
    expect(canEditDraft({ tag: 'error', issue: micIssue }, false, true, 'voice')).toBe(true);
    expect(canEditDraft({ tag: 'paused' }, false, true, 'voice')).toBe(true);
  });

  it('does not offer a typed fallback during the spoken rehearsal', () => {
    expect(canOfferTypeInstead({ tag: 'idle' }, false, 'spoken_rehearsal')).toBe(false);
  });
});
