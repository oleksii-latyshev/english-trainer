import type { Page } from '@playwright/test';
export type NaturalVoiceEdge = {
  prewarms: number;
  requests: { text: string; voice_id: number; speed: number }[];
  played: number;
  paused: number;
  resumed: number;
  stopped: number;
  finishAudio: () => void;
};
declare global {
  interface Window {
    __ET_NATURAL__: NaturalVoiceEdge;
  }
}
export async function installNaturalVoice(
  page: Page,
  options: {
    delayMs?: number;
    fails?: boolean;
    failsOnce?: boolean;
    mediaFails?: boolean;
    ready?: boolean;
  } = {},
) {
  await page.addInitScript((seed) => {
    const edge: NaturalVoiceEdge = {
      prewarms: 0,
      requests: [],
      played: 0,
      paused: 0,
      resumed: 0,
      stopped: 0,
      finishAudio: () => {},
    };
    window.__ET_NATURAL__ = edge;
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const requestArgs = (args?: Record<string, unknown>) => {
      const text = args?.text,
        voice_id = args?.voice_id,
        speed = args?.speed;
      if (typeof text !== 'string' || typeof voice_id !== 'number' || typeof speed !== 'number')
        throw new Error('Invalid natural speech arguments');
      return { text, voice_id, speed };
    };
    window.__TAURI_INTERNALS__.invoke = async (command, args) => {
      if (command === 'prewarm_natural_voice') {
        edge.prewarms++;
        return seed.ready !== false;
      }
      if (command !== 'synthesize_natural_voice') return invoke(command, args);
      edge.requests.push(requestArgs(args));
      if (seed.delayMs) await new Promise((resolve) => setTimeout(resolve, seed.delayMs));
      if (seed.fails || (seed.failsOnce && edge.requests.length === 1))
        throw { code: 'unavailable', message: 'Fixture local speech unavailable' };
      const wav = new Uint8Array(46);
      wav.set([82, 73, 70, 70, 38, 0, 0, 0, 87, 65, 86, 69]);
      return wav.buffer;
    };
    type Media = {
      onplaying: (() => void) | null;
      onended: (() => void) | null;
      onerror: (() => void) | null;
      play: () => Promise<void>;
      pause: () => void;
      removeAttribute: () => void;
      load: () => void;
    };
    Object.defineProperty(window, 'Audio', {
      value: function (this: Media) {
        this.onplaying = null;
        this.onended = null;
        this.onerror = null;
        let started = false,
          stopped = false;
        this.play = async () => {
          if (seed.mediaFails) throw new Error('Fixture media playback unavailable');
          if (!started) {
            edge.played++;
            started = true;
          } else edge.resumed++;
          edge.finishAudio = () => {
            this.onended?.();
          };
          queueMicrotask(() => {
            if (!stopped) this.onplaying?.();
          });
        };
        this.pause = () => {
          if (!stopped) edge.paused++;
        };
        this.removeAttribute = () => {
          if (!stopped) edge.stopped++;
          stopped = true;
        };
        this.load = () => {};
      },
    });
  }, options);
}

export type NaturalVoiceOptions = Parameters<typeof installNaturalVoice>[1];

export class NaturalVoiceBackend {
  enabled = false;
  private options: NonNullable<NaturalVoiceOptions> = {};

  constructor(private readonly page: Page) {}

  available(): this {
    return this.configure({});
  }

  delayingBy(ms: number): this {
    return this.configure({ delayMs: ms });
  }

  failing(): this {
    return this.configure({ fails: true });
  }

  failingOnce(): this {
    return this.configure({ failsOnce: true });
  }

  failingMediaPlayback(): this {
    return this.configure({ mediaFails: true });
  }

  notReady(): this {
    return this.configure({ ready: false });
  }

  async install(): Promise<void> {
    if (this.enabled) await installNaturalVoice(this.page, this.options);
  }

  state(): Promise<Omit<NaturalVoiceEdge, 'finishAudio'>> {
    return this.page.evaluate(() => ({ ...window.__ET_NATURAL__, finishAudio: undefined }));
  }

  async finishAudio(): Promise<void> {
    await this.page.evaluate(() => window.__ET_NATURAL__.finishAudio());
  }

  private configure(change: NonNullable<NaturalVoiceOptions>): this {
    this.enabled = true;
    this.options = { ...this.options, ...change };
    return this;
  }
}
