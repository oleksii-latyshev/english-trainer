import type { Page } from '@playwright/test';
export type NaturalVoiceEdge = {
  prewarms: number;
  requests: { text: string; voice_id: number; speed: number }[];
  played: number;
  paused: number;
  resumed: number;
  stopped: number;
  settled: number;
  releaseGeneration: () => void;
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
    holdGeneration?: boolean;
    escapeOnRequest?: boolean;
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
      settled: 0,
      releaseGeneration: () => {},
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
    const receiveRequest = async (args?: Record<string, unknown>) => {
      edge.requests.push(requestArgs(args));
      if (seed.escapeOnRequest)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      if (seed.delayMs) await new Promise((resolve) => setTimeout(resolve, seed.delayMs));
      if (seed.holdGeneration)
        await new Promise<void>((resolve) => {
          edge.releaseGeneration = resolve;
        });
      edge.settled++;
      if (seed.fails || (seed.failsOnce && edge.requests.length === 1))
        throw { code: 'unavailable', message: 'Fixture local speech unavailable' };
    };
    window.__TAURI_INTERNALS__.invoke = async (command, args) => {
      if (command === 'prewarm_natural_voice') {
        edge.prewarms++;
        return seed.ready !== false;
      }
      if (command !== 'synthesize_natural_voice') return invoke(command, args);
      await receiveRequest(args);
      const wav = new Uint8Array(46);
      wav.set([82, 73, 70, 70, 38, 0, 0, 0, 87, 65, 86, 69]);
      return wav.buffer;
    };
    type Playback = { startsAt: number; endsAt: number; started: boolean; stopped: boolean };
    const playbacks: Playback[] = [];
    const flagged = new WeakSet<object>();
    const clock = { seconds: 0, suspended: false };
    const isPlaying = (playback: Playback) =>
      !playback.stopped && playback.startsAt <= clock.seconds && clock.seconds < playback.endsAt;
    const settle = () => {
      if (!playbacks.some(isPlaying)) {
        const upcoming = playbacks
          .filter((playback) => !playback.stopped && playback.startsAt > clock.seconds)
          .sort((a, b) => a.startsAt - b.startsAt)[0];
        if (upcoming) clock.seconds = upcoming.startsAt;
      }
      for (const playback of playbacks) {
        if (playback.startsAt <= clock.seconds) playback.started = true;
      }
    };
    Object.defineProperties(edge, {
      played: {
        get: () => {
          settle();
          return playbacks.filter((playback) => playback.started).length;
        },
      },
    });
    edge.finishAudio = () => {
      const current = playbacks.find(isPlaying);
      if (current) clock.seconds = current.endsAt;
      settle();
    };
    const CLIP_SECONDS = 2;
    const RealAudioContext = window.AudioContext;
    class PlaybackAwareContext extends RealAudioContext {
      override get currentTime(): number {
        if (!flagged.has(this)) return super.currentTime;
        settle();
        return clock.seconds;
      }
      override decodeAudioData(): Promise<AudioBuffer> {
        flagged.add(this);
        if (seed.mediaFails) return Promise.reject(new Error('Fixture media playback unavailable'));
        const buffer: object = { duration: CLIP_SECONDS };
        return Promise.resolve(buffer as AudioBuffer);
      }
      override createBufferSource(): AudioBufferSourceNode {
        flagged.add(this);
        const playback: Playback = { startsAt: 0, endsAt: 0, started: false, stopped: false };
        const source = {
          buffer: null as { duration: number } | null,
          onended: null,
          connect: () => undefined,
          disconnect: () => undefined,
          start: (when: number) => {
            playback.startsAt = when;
            playback.endsAt = when + (source.buffer?.duration ?? CLIP_SECONDS);
            playbacks.push(playback);
          },
          stop: () => {
            if (playback.stopped) return;
            if (playback.startsAt <= clock.seconds) playback.started = true;
            if (clock.seconds < playback.endsAt) edge.stopped++;
            playback.stopped = true;
          },
        };
        return source as unknown as AudioBufferSourceNode;
      }
      override suspend(): Promise<void> {
        if (!flagged.has(this)) return super.suspend();
        clock.suspended = true;
        edge.paused++;
        return Promise.resolve();
      }
      override resume(): Promise<void> {
        if (!flagged.has(this)) return super.resume();
        if (clock.suspended) edge.resumed++;
        clock.suspended = false;
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: PlaybackAwareContext });
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

  holdingGeneration(): this {
    return this.configure({ holdGeneration: true });
  }

  interruptedOnRequest(): this {
    return this.configure({ escapeOnRequest: true });
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

  state(): Promise<Omit<NaturalVoiceEdge, 'finishAudio' | 'releaseGeneration'>> {
    return this.page.evaluate(() => ({
      ...window.__ET_NATURAL__,
      finishAudio: undefined,
      releaseGeneration: undefined,
    }));
  }

  async releaseGeneration(): Promise<void> {
    await this.page.evaluate(() => window.__ET_NATURAL__.releaseGeneration());
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
