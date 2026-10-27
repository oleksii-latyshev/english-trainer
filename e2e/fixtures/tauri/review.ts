import type { Page } from '@playwright/test';
import type {
  LearningMemoryView,
  MemoryReviewRun,
  ReviewMaterials,
  SpeechEngineStatus,
} from '@/core/ipc';
import { reviewMemory, reviewMemoryWithDuePhrase } from '../../data/review-memory';
import { unavailableSpeechStatus } from '../../data/sessions';

export type ReviewOptions = {
  completedRunWithDuePhrase?: boolean;
  emptyWarmup?: boolean;
  failPreparationOnce?: boolean;
  holdInitialFinish?: boolean;
  holdPreparation?: boolean;
  throwPreparation?: boolean;
  failReveal?: boolean;
  silentAudio?: boolean;
};

declare global {
  interface Window {
    __ET_REVIEW__: {
      run: MemoryReviewRun;
      materials: ReviewMaterials;
      calls: string[];
      failPreparationOnce: boolean;
      completePreparation: () => void;
      completeFinish: (success: boolean) => void;
      scored: boolean;
    };
  }
}

export async function installReview(page: Page, options: ReviewOptions = {}) {
  const run: MemoryReviewRun = {
    run_id: 71,
    completed: false,
    items: [
      {
        position: 1,
        item_type: 'phrase',
        item_id: 51,
        cue: 'Agree on a solution.',
        target: null,
        transcript: null,
        wording_observed: null,
        saved_response: null,
        next_review_at: null,
        interval_days: null,
        status: null,
        is_skipped: false,
      },
    ],
  };
  const materials: ReviewMaterials = {
    run_id: 71,
    preparation: { state: 'legacy' },
    items: [{ position: 1, situation: null, model_answer: null, hint: null, is_cued: false }],
  };
  const completedItem: MemoryReviewRun['items'][number] = {
    position: 1,
    item_type: 'phrase',
    item_id: 51,
    cue: 'Agree on a solution.',
    target: 'find a compromise',
    transcript: 'We can find a compromise.',
    wording_observed: true,
    saved_response: 'remembered',
    next_review_at: 1_800_086_400_000,
    interval_days: 2,
    status: 'improving',
    is_skipped: false,
  };
  await page.addInitScript(
    (seed: {
      run: MemoryReviewRun;
      memory: LearningMemoryView;
      materials: ReviewMaterials;
      speechStatus: SpeechEngineStatus;
      options: ReviewOptions;
    }) => {
      const original = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__);
      const state = {
        run: seed.run,
        materials: seed.materials,
        calls: [] as string[],
        failPreparationOnce: seed.options.failPreparationOnce ?? false,
        completePreparation: () => {},
        completeFinish: (_success: boolean) => {},
        scored: seed.options.completedRunWithDuePhrase ?? false,
      };
      Object.defineProperty(window, '__ET_REVIEW__', { value: state });
      const retainedAudioContexts: AudioContext[] = [];
      navigator.mediaDevices.getUserMedia = async () => {
        window.__ET_AUDIO_COUNTS__.mediaRequests += 1;
        const context = new AudioContext();
        retainedAudioContexts.push(context);
        const destination = context.createMediaStreamDestination();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 220;
        gain.gain.value = seed.options.silentAudio ? 0 : 0.12;
        oscillator.connect(gain).connect(destination);
        oscillator.start();
        await context.resume();
        return destination.stream;
      };
      const startReview = (args: Record<string, unknown>) => {
        const warmup = args.warmup === true;
        state.calls.push(`start_memory_review:${String(warmup)}`);
        return seed.options.emptyWarmup && warmup ? null : state.run;
      };
      let heldInitialFinish = false;
      const makeReady = () => {
        state.materials = {
          run_id: 71,
          preparation: { state: 'ready' },
          items: [
            {
              position: 1,
              situation: 'Your team has two good ideas. Suggest how to agree on one.',
              model_answer: state.scored ? 'Could we find a compromise?' : null,
              hint: state.materials.items[0].hint,
              is_cued: state.materials.items[0].is_cued,
            },
          ],
        };
        return state.materials;
      };
      const prepare = async (args: Record<string, unknown>) => {
        state.calls.push('prepare_review_material');
        if (seed.options.throwPreparation) throw { code: 'unavailable', message: 'Try again.' };
        if (
          state.materials.preparation.state === 'ready' ||
          (state.materials.preparation.state === 'failed' && args.retry !== true)
        ) {
          return state.materials;
        }
        if (state.failPreparationOnce) {
          state.failPreparationOnce = false;
          state.materials = {
            ...state.materials,
            preparation: {
              state: 'failed',
              error: { code: 'timeout', message: 'The review service timed out. Try again.' },
            },
          };
          return state.materials;
        }
        if (!seed.options.holdPreparation) return makeReady();
        return new Promise<ReviewMaterials>((resolve) => {
          state.completePreparation = () => resolve(makeReady());
        });
      };
      const reveal = () => {
        state.calls.push('reveal_review_phrase');
        if (seed.options.failReveal) throw { code: 'database_error', message: 'Try again.' };
        state.materials = {
          ...state.materials,
          items: state.materials.items.map((item) => ({
            ...item,
            hint: 'find a compromise',
            is_cued: true,
          })),
        };
        return state.materials;
      };
      const skip = () => {
        state.run = {
          ...state.run,
          items: state.run.items.map((item) => ({
            position: item.position,
            item_type: item.item_type,
            item_id: item.item_id,
            cue: item.cue,
            target: null,
            transcript: null,
            wording_observed: null,
            saved_response: null,
            next_review_at: null,
            interval_days: null,
            status: null,
            is_skipped: true,
          })),
        };
        return state.run;
      };
      const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
        get_speech_engine_status: () => seed.speechStatus,
        get_learning_memory: () => seed.memory,
        view_learning_memory: () => seed.memory,
        start_memory_review: startReview,
        start_item_review: (args) => {
          state.calls.push(`start_item_review:${String(args.item_type)}:${String(args.item_id)}`);
          return state.run;
        },
        prepare_review_material: prepare,
        get_review_material: () => state.materials,
        reveal_review_phrase: reveal,
        skip_memory_review_item: skip,
        finish_memory_review: () => {
          state.calls.push('finish_memory_review');
          if (seed.options.holdInitialFinish && !heldInitialFinish) {
            heldInitialFinish = true;
            return new Promise<null>((resolve, reject) => {
              state.completeFinish = (success) =>
                success ? resolve(null) : reject({ code: 'database_error', message: 'Try again.' });
            });
          }
          return null;
        },
        get_memory_review: () => null,
        get_memory_usage_evidence: (args) => ({
          item_type: args.item_type,
          item_id: args.item_id,
          distinct_session_count: 0,
          streak: 0,
          events: [],
        }),
        transcribe_audio: () => ({
          text: 'We can find a compromise.',
          language: 'en',
          duration_ms: 1800,
        }),
        submit_memory_recall: (args) => {
          state.calls.push('submit_memory_recall');
          state.scored = true;
          state.materials = {
            ...state.materials,
            items: state.materials.items.map((item) => ({
              ...item,
              model_answer: 'Could we find a compromise?',
            })),
          };
          return {
            run_id: args.run_id,
            position: 1,
            item_type: 'phrase',
            item_id: 51,
            cue: 'Agree on a solution.',
            target: 'find a compromise',
            transcript: String(args.transcript),
            wording_observed: true,
            saved_response: 'remembered',
            next_review_at: 1_800_086_400_000,
            interval_days: 2,
            status: 'improving',
          };
        },
      };
      window.__TAURI_INTERNALS__.invoke = async (command, rawArgs = {}) => {
        const handler = handlers[command];
        return handler ? handler(rawArgs) : original(command, rawArgs);
      };
    },
    {
      run: options.completedRunWithDuePhrase ? { ...run, items: [completedItem] } : run,
      memory: options.completedRunWithDuePhrase ? reviewMemoryWithDuePhrase : reviewMemory,
      materials,
      speechStatus: unavailableSpeechStatus,
      options,
    },
  );
}
