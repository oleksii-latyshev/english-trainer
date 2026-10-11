import type { Page } from '@playwright/test';
import type { SpeechEngineStatus } from '@/lib/speechTypes';

export type LiveReviewOptions = {
  unavailable?: boolean;
  failPartial?: boolean;
  holdPartial?: boolean;
  holdStatus?: boolean;
  silentAudio?: boolean;
  cold?: boolean;
};

declare global {
  interface Window {
    __ET_LIVE_REVIEW__: {
      partialCalls: number;
      warmCalls: number;
      finalCalls: number;
      submitted: string[];
      releasePartial: () => void;
      releaseStatus: () => void;
    };
  }
}

/** Fake only local STT IPC; recording still travels through the real PCM/audio graph. */
export async function installLiveReview(page: Page, options: LiveReviewOptions = {}) {
  const status: SpeechEngineStatus = {
    server: options.cold ? 'not_running' : 'ready',
    failure: null,
    is_live_transcript_available: !options.unavailable,
  };
  await page.addInitScript(
    (seed: { options: LiveReviewOptions; status: SpeechEngineStatus }) => {
      const original = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
      const state = {
        partialCalls: 0,
        warmCalls: 0,
        finalCalls: 0,
        submitted: [] as string[],
        releasePartial: () => {},
        releaseStatus: () => {},
      };
      Object.defineProperty(window, '__ET_LIVE_REVIEW__', { value: state });
      let statusHeld = false;
      let partialHeld = false;
      const engineStatus = () => {
        if (!seed.options.holdStatus || statusHeld) return seed.status;
        statusHeld = true;
        return new Promise<SpeechEngineStatus>((resolve) => {
          state.releaseStatus = () => resolve(seed.status);
        });
      };
      const partial = () => {
        state.partialCalls += 1;
        if (seed.options.failPartial) throw { code: 'timeout', message: 'Try again.' };
        if (!seed.options.holdPartial || partialHeld) return 'A provisional suggestion';
        partialHeld = true;
        return new Promise<string>((resolve) => {
          state.releasePartial = () => resolve('A late provisional suggestion');
        });
      };
      window.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
        if (command === 'warm_speech_engine') {
          state.warmCalls += 1;
          seed.status.server = 'ready';
          return null;
        }
        if (command === 'get_speech_engine_status') return engineStatus();
        if (command === 'transcribe_partial') return partial();
        if (command === 'transcribe_audio') state.finalCalls += 1;
        if (command === 'submit_memory_recall') state.submitted.push(String(args.transcript));
        return original(command, args);
      };
    },
    { options, status },
  );
}

export class LiveReviewBackend {
  enabled = false;
  private options: LiveReviewOptions = {};

  constructor(private readonly page: Page) {}

  withLiveTranscript(): this {
    return this.configure({});
  }

  withColdEngine(): this {
    return this.configure({ cold: true });
  }

  withLiveTranscriptUnavailable(): this {
    return this.configure({ unavailable: true });
  }

  failingPartials(): this {
    return this.configure({ failPartial: true });
  }

  holdingPartial(): this {
    return this.configure({ holdPartial: true });
  }

  holdingEngineStatus(): this {
    return this.configure({ holdStatus: true });
  }

  withSilentAudio(): this {
    return this.configure({ silentAudio: true });
  }

  get silentAudio(): boolean {
    return this.options.silentAudio === true;
  }

  async install(): Promise<void> {
    if (this.enabled) await installLiveReview(this.page, this.options);
  }

  partialCalls(): Promise<number> {
    return this.page.evaluate(() => window.__ET_LIVE_REVIEW__.partialCalls);
  }

  warmCalls(): Promise<number> {
    return this.page.evaluate(() => window.__ET_LIVE_REVIEW__.warmCalls);
  }

  finalCalls(): Promise<number> {
    return this.page.evaluate(() => window.__ET_LIVE_REVIEW__.finalCalls);
  }

  submitted(): Promise<string[]> {
    return this.page.evaluate(() => window.__ET_LIVE_REVIEW__.submitted);
  }

  async releasePartial(): Promise<void> {
    await this.page.evaluate(() => window.__ET_LIVE_REVIEW__.releasePartial());
  }

  async releaseEngineStatus(): Promise<void> {
    await this.page.evaluate(() => window.__ET_LIVE_REVIEW__.releaseStatus());
  }

  private configure(change: LiveReviewOptions): this {
    this.enabled = true;
    this.options = { ...this.options, ...change };
    return this;
  }
}
