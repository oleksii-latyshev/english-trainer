import type { Page } from '@playwright/test';
import type { SpeechEngineStatus } from '../src/lib/speechTypes';
import { installReviewFixture } from './reviewFixture';

type Options = {
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
export async function installLiveReviewFixture(page: Page, options: Options = {}) {
  await installReviewFixture(page, { silentAudio: options.silentAudio });
  const status: SpeechEngineStatus = {
    server: options.cold ? 'not_running' : 'ready',
    failure: null,
    is_live_transcript_available: !options.unavailable,
  };
  await page.addInitScript(
    (seed: { options: Options; status: SpeechEngineStatus }) => {
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
