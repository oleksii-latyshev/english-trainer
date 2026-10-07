// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  canSendPracticeInput,
  inputSourceLabel,
  resolveInputSource,
  shouldAutoSendVoiceTranscript,
} from './inputSource';

describe('resolveInputSource', () => {
  it('returns voice when new recognized transcript matches draft unchanged', () => {
    const source = resolveInputSource({
      draft: 'I worked on a frontend project today.',
      recognizedText: 'I worked on a frontend project today.',
      isNewVoice: true,
    });
    expect(source).toBe('voice');
  });

  it('returns edited when new recognized transcript was modified', () => {
    const source = resolveInputSource({
      draft: 'I worked on a backend project today.',
      recognizedText: 'I worked on a frontend project today.',
      isNewVoice: true,
    });
    expect(source).toBe('edited');
  });

  it('returns text when there was no voice recognition', () => {
    const source = resolveInputSource({
      draft: 'I typed this manually.',
      recognizedText: undefined,
      isNewVoice: false,
    });
    expect(source).toBe('text');
  });

  it('returns text when voice is not marked new (stale or restored)', () => {
    const source = resolveInputSource({
      draft: 'Old transcript from previous turn',
      recognizedText: 'Old transcript from previous turn',
      isNewVoice: false,
    });
    expect(source).toBe('text');
  });

  it('blocks keyboard and button sends while recording, transcribing, busy, reviewing, recalling, or retrying', () => {
    const idle = {
      busy: false,
      isRecording: false,
      transcribing: false,
      disabled: false,
      isRetrying: false,
      recallActive: false,
      isSending: false,
    };
    expect(canSendPracticeInput(idle)).toBe(true);
    for (const blocked of [
      { busy: true },
      { isRecording: true },
      { transcribing: true },
      { disabled: true },
      { isRetrying: true },
      { recallActive: true },
      { isSending: true },
    ]) {
      expect(canSendPracticeInput({ ...idle, ...blocked })).toBe(false);
    }
  });

  it('auto-sends once for each new capture ID, even when consecutive transcripts match', () => {
    const newCapture = {
      transcript: 'Same recognized words',
      initialRequestId: 10,
      hadTranscriptAtMount: false,
      processedRequestId: 11,
      autoSendVoice: true,
      canSend: true,
    };
    expect(shouldAutoSendVoiceTranscript({ ...newCapture, requestId: 11 })).toBe(false);
    expect(shouldAutoSendVoiceTranscript({ ...newCapture, requestId: 12 })).toBe(true);
  });

  it('does not auto-send a mount-time transcript or one completed before enabling the option', () => {
    expect(
      shouldAutoSendVoiceTranscript({
        transcript: 'Existing answer',
        requestId: 10,
        initialRequestId: 10,
        hadTranscriptAtMount: true,
        autoSendVoice: true,
        canSend: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoSendVoiceTranscript({
        transcript: 'Earlier answer',
        requestId: 11,
        initialRequestId: 10,
        hadTranscriptAtMount: true,
        autoSendVoice: false,
        canSend: true,
      }),
    ).toBe(false);
  });

  it('auto-sends when a capture already in progress at mount completes afterward', () => {
    expect(
      shouldAutoSendVoiceTranscript({
        transcript: 'Completed after mount',
        requestId: 10,
        initialRequestId: 10,
        hadTranscriptAtMount: false,
        autoSendVoice: true,
        canSend: true,
      }),
    ).toBe(true);
  });
});

describe('inputSourceLabel', () => {
  it('names how an answer was given', () => {
    expect(inputSourceLabel('voice')).toBe('spoken');
    expect(inputSourceLabel('text')).toBe('typed');
    expect(inputSourceLabel('edited')).toBe('edited');
    expect(inputSourceLabel(undefined)).toBeUndefined();
  });
});
