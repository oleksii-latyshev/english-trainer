import type { Page } from '@playwright/test';

export type AudioEdgeCounts = { mediaRequests: number; speechRequests: number };

/** Completes browser TTS calls immediately so tests never play real audio or wait on platform voices. */
export async function installSpeechFixture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type FakeUtterance = {
      voice: unknown;
      rate: number;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
    };
    const counts = { mediaRequests: 0, speechRequests: 0 };
    Object.defineProperty(window, '__ET_AUDIO_COUNTS__', { value: counts });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => {
          counts.mediaRequests += 1;
          throw new DOMException(
            'Microphone access is unavailable in this browser test.',
            'NotAllowedError',
          );
        },
        enumerateDevices: async () => [],
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: function (this: FakeUtterance) {
        this.voice = null;
        this.rate = 1;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ voiceURI: 'fixture-en-us', lang: 'en-US' }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        cancel: () => undefined,
        pause: () => undefined,
        resume: () => undefined,
        speak: (utterance: FakeUtterance) => {
          counts.speechRequests += 1;
          queueMicrotask(() => {
            utterance.onstart?.();
            utterance.onend?.();
          });
        },
      },
    });
  });
}
