import type { Page } from '@playwright/test';
import type { LearningMemoryView } from '../src/lib/learningTypes';
import type { MemoryReviewRun } from '../src/lib/memoryRecallTypes';
import type { ReviewMaterials } from '../src/lib/reviewMaterialTypes';
import type { SpeechEngineStatus } from '../src/lib/speechTypes';
import { unavailableSpeechStatus } from './fixtureData';
import { installTauriFixture } from './tauriFixture';

export type ReviewFixtureOptions = {
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

const memory: LearningMemoryView = {
  mistakes: [],
  due_count: 1,
  phrase_cards: [
    {
      id: 51,
      phrase: 'find a compromise',
      normalized_phrase: 'find a compromise',
      meaning_or_note: 'Agree on a solution.',
      session_id: null,
      sequence: null,
      created_at: 1_800_000_000_000,
      last_reviewed_at: null,
      next_review_at: 1_800_000_000_000,
      interval_days: 1,
      ease_factor: 2.5,
      status: 'learning',
      is_due: true,
    },
  ],
};

const memoryWithDuePhrase: LearningMemoryView = {
  ...memory,
  due_count: 1,
  phrase_cards: [
    {
      ...memory.phrase_cards[0],
      is_due: false,
      last_reviewed_at: 1_800_000_000_000,
      next_review_at: 1_800_086_400_000,
      interval_days: 2,
      status: 'improving',
    },
    {
      ...memory.phrase_cards[0],
      id: 52,
      phrase: 'raise a concern',
      normalized_phrase: 'raise a concern',
      meaning_or_note: 'Mention a problem or worry.',
    },
  ],
};

export async function installReviewFixture(page: Page, options: ReviewFixtureOptions = {}) {
  await installTauriFixture(page, {
    learningMemory: options.completedRunWithDuePhrase ? memoryWithDuePhrase : memory,
  });
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
      options: ReviewFixtureOptions;
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
        prepare_review_material: prepare,
        get_review_material: () => state.materials,
        reveal_review_phrase: reveal,
        skip_memory_review_item: skip,
        finish_memory_review: () => {
          state.calls.push('finish_memory_review');
          if (seed.options.holdInitialFinish && !heldInitialFinish) {
            heldInitialFinish = true;
            return new Promise<boolean>((resolve, reject) => {
              state.completeFinish = (success) =>
                success ? resolve(true) : reject({ code: 'database_error', message: 'Try again.' });
            });
          }
          return true;
        },
        get_memory_review: () => null,
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
      memory: options.completedRunWithDuePhrase ? memoryWithDuePhrase : memory,
      materials,
      speechStatus: unavailableSpeechStatus,
      options,
    },
  );
}
