import { describe, expect, it } from 'bun:test';
import { canSendDraft, resolveInputSource, shouldAutoSendVoiceTranscript } from '.';

describe('resolveInputSource', () => {
  it('returns voice when the new recognized transcript is sent unchanged', () => {
    expect(
      resolveInputSource({
        draft: 'I worked on a frontend project today.',
        recognizedText: 'I worked on a frontend project today.',
        isNewVoice: true,
      }),
    ).toBe('voice');
  });

  it('returns edited when the new recognized transcript was modified', () => {
    expect(
      resolveInputSource({
        draft: 'I worked on a backend project today.',
        recognizedText: 'I worked on a frontend project today.',
        isNewVoice: true,
      }),
    ).toBe('edited');
  });

  it('returns text when there was no voice recognition', () => {
    expect(
      resolveInputSource({
        draft: 'I typed this manually.',
        recognizedText: undefined,
        isNewVoice: false,
      }),
    ).toBe('text');
  });

  it('returns text when the voice is stale or restored', () => {
    expect(
      resolveInputSource({
        draft: 'Old transcript from previous turn',
        recognizedText: 'Old transcript from previous turn',
        isNewVoice: false,
      }),
    ).toBe('text');
  });
});

describe('canSendDraft', () => {
  const idle = { isBusy: false, isCapturing: false, isLocked: false, isSending: false };

  it('allows a send when nothing else is happening', () => {
    expect(canSendDraft(idle)).toBe(true);
  });

  it.each([{ isBusy: true }, { isCapturing: true }, { isLocked: true }, { isSending: true }])(
    'blocks a send when %p',
    (blocked) => {
      expect(canSendDraft({ ...idle, ...blocked })).toBe(false);
    },
  );
});

describe('shouldAutoSendVoiceTranscript', () => {
  const newCapture = {
    transcript: 'Same recognized words',
    processedRequestId: 11,
    autoSendVoice: true,
    canSend: true,
  };

  it('sends once for each new capture, even when consecutive transcripts match', () => {
    expect(shouldAutoSendVoiceTranscript({ ...newCapture, requestId: 11 })).toBe(false);
    expect(shouldAutoSendVoiceTranscript({ ...newCapture, requestId: 12 })).toBe(true);
  });

  it('does not send when the option is off or sending is blocked', () => {
    expect(
      shouldAutoSendVoiceTranscript({ ...newCapture, requestId: 12, autoSendVoice: false }),
    ).toBe(false);
    expect(shouldAutoSendVoiceTranscript({ ...newCapture, requestId: 12, canSend: false })).toBe(
      false,
    );
  });

  it('does not send an empty transcript', () => {
    expect(shouldAutoSendVoiceTranscript({ ...newCapture, requestId: 12, transcript: '  ' })).toBe(
      false,
    );
  });
});
