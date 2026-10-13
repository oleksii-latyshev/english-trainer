import type { Page } from '@playwright/test';

export type AudioEdgeCounts = { mediaRequests: number; speechRequests: number };

export async function installSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type FakeUtterance = {
      text: string;
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
      value: function (this: FakeUtterance, text: string) {
        this.text = text;
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

export class SpeechBackend {
  private isMicrophoneGranted = false;

  constructor(private readonly page: Page) {}

  grantMicrophone(): void {
    this.isMicrophoneGranted = true;
  }

  async install(): Promise<void> {
    if (!this.isMicrophoneGranted) return;
    await this.page.addInitScript(() => {
      const retainedAudioContexts: AudioContext[] = [];
      navigator.mediaDevices.getUserMedia = async () => {
        window.__ET_AUDIO_COUNTS__.mediaRequests += 1;
        const context = new AudioContext();
        retainedAudioContexts.push(context);
        const destination = context.createMediaStreamDestination();
        const tone = context.createOscillator();
        tone.connect(destination);
        tone.start();
        return destination.stream;
      };
    });
  }

  counts(): Promise<AudioEdgeCounts> {
    return this.page.evaluate(() => window.__ET_AUDIO_COUNTS__);
  }
}
