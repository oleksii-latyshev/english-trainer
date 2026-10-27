import { Effect, Layer } from 'effect';
import { Reactivity } from 'effect/reactivity';
import type { MicrophoneError, RecordedClip } from '@/core/audio';
import { Ipc, IpcError } from '@/core/ipc';
import {
  LearningMemoryService,
  type RecallResult,
  type ReviewItem,
  type ReviewMaterials,
  type ReviewRun,
  ReviewRunService,
} from '@/core/learning-memory';
import type { SpeechRecognitionFailure, TranscribedAnswer } from '@/core/speech';
import { AnswerCapture } from '../services/answer-capture-service';

if (typeof window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true, writable: true });
}

export function aReviewItem(position: number, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    position,
    item_type: 'phrase',
    item_id: 50 + position,
    cue: `Cue ${position}`,
    target: null,
    transcript: null,
    wording_observed: null,
    saved_response: null,
    next_review_at: null,
    interval_days: null,
    status: null,
    is_skipped: false,
    ...overrides,
  };
}

export function aReviewRun(itemCount = 2, overrides: Partial<ReviewRun> = {}): ReviewRun {
  return {
    run_id: 71,
    completed: false,
    items: Array.from({ length: itemCount }, (_, index) => aReviewItem(index + 1)),
    ...overrides,
  };
}

function aRecallResult(position: number, overrides: Partial<RecallResult> = {}): RecallResult {
  return {
    run_id: 71,
    position,
    item_type: 'phrase',
    item_id: 50 + position,
    cue: `Cue ${position}`,
    target: `Target ${position}`,
    transcript: `I said target ${position}`,
    wording_observed: true,
    saved_response: 'remembered',
    next_review_at: 1_000,
    interval_days: 2,
    status: 'learning',
    ...overrides,
  };
}

function aMaterials(overrides: Partial<ReviewMaterials> = {}): ReviewMaterials {
  return {
    run_id: 71,
    preparation: { state: 'ready' },
    items: [
      { position: 1, situation: 'A situation.', model_answer: null, hint: null, is_cued: false },
      { position: 2, situation: 'Another one.', model_answer: null, hint: null, is_cued: false },
    ],
    ...overrides,
  };
}

export type Backend = {
  run: ReviewRun | null;
  materials: ReviewMaterials;
  failing: Set<string>;
  calls: Array<{ command: string; args: Record<string, unknown> }>;
  result: (args: Record<string, unknown>) => RecallResult;
};

export function makeBackend(overrides: Partial<Backend> = {}): Backend {
  return {
    run: aReviewRun(),
    materials: aMaterials({
      preparation: { state: 'legacy' },
      items: [
        { position: 1, situation: null, model_answer: null, hint: null, is_cued: false },
        { position: 2, situation: null, model_answer: null, hint: null, is_cued: false },
      ],
    }),
    failing: new Set(),
    calls: [],
    result: (args) =>
      aRecallResult(Number(args.item_id) - 50, { transcript: String(args.transcript) }),
    ...overrides,
  };
}

function skipFirstPending(run: ReviewRun, args: Record<string, unknown>): ReviewRun {
  return {
    ...run,
    items: run.items.map((item) =>
      item.item_id === args.item_id ? { ...item, is_skipped: true } : item,
    ),
  };
}

function answer(backend: Backend, command: string, args: Record<string, unknown>): unknown {
  switch (command) {
    case 'get_learning_memory':
      return { mistakes: [], phrase_cards: [], due_count: 0 };
    case 'start_memory_review':
    case 'get_memory_review':
      return backend.run;
    case 'prepare_review_material':
      if (backend.materials.preparation.state === 'legacy') {
        backend.materials = aMaterials();
      }
      return backend.materials;
    case 'get_review_material':
      return backend.materials;
    case 'reveal_review_phrase':
      backend.materials = {
        ...backend.materials,
        items: backend.materials.items.map((item) => ({
          ...item,
          hint: 'the phrase',
          is_cued: true,
        })),
      };
      return backend.materials;
    case 'submit_memory_recall':
      return backend.result(args);
    case 'skip_memory_review_item':
      backend.run = skipFirstPending(backend.run as ReviewRun, args);
      return backend.run;
    case 'finish_memory_review':
      return null;
    default:
      return null;
  }
}

function ipcLayer(backend: Backend) {
  return Layer.succeed(Ipc, {
    invoke: (command, args) =>
      Effect.suspend(() => {
        backend.calls.push({ command, args: { ...args } });
        if (backend.failing.has(command)) {
          return Effect.fail(new IpcError({ code: 'database_error', message: 'Try again.' }));
        }
        return Effect.succeed(answer(backend, command, { ...args }));
      }),
  });
}

export function learningLayer(backend: Backend) {
  return Layer.mergeAll(LearningMemoryService.layer, ReviewRunService.layer).pipe(
    Layer.provide(ipcLayer(backend)),
    Layer.provideMerge(Reactivity.layer),
  );
}

export type Microphone = {
  clip: () => Effect.Effect<RecordedClip, MicrophoneError>;
  transcript: () => Effect.Effect<TranscribedAnswer, SpeechRecognitionFailure>;
  liveTexts: string[];
};

export function captureLayer(microphone: Microphone) {
  return Layer.succeed(AnswerCapture, {
    record: (onLiveText) =>
      Effect.suspend(() => {
        for (const text of microphone.liveTexts) onLiveText(text);
        return microphone.clip();
      }),
    transcribe: () => Effect.suspend(microphone.transcript),
  });
}

export const A_CLIP: RecordedClip = {
  wav: new Blob(['wav']),
  durationMs: 1500,
  signal: { capturedMs: 1500, elapsedMs: 1600, windows: [] },
  input: { deviceId: 'usb', label: 'USB microphone' },
};
