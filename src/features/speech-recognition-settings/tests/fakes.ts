import { Effect, Layer, SubscriptionRef } from 'effect';
import { Reactivity } from 'effect/reactivity';
import { type ClipPhase, ClipRecorder, IDLE_CLIP, type RecordedClip } from '@/core/audio';
import { Ipc, IpcBinary, IpcDecodeError } from '@/core/ipc';
import { SpeechRecognition, SpeechRecognitionSettings } from '@/core/speech';
import { SentenceRecording } from '../services/sentence-recording-service';

if (typeof window === 'undefined') {
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true, writable: true });
}
Object.assign(window, {
  __TAURI_INTERNALS__: { transformCallback: () => 1, unregisterCallback: () => {} },
});

export const INPUT = { deviceId: 'usb', label: 'USB microphone' };

const SENTENCES = [
  { index: 1, text: 'First sentence.', is_recorded: false },
  { index: 2, text: 'Second sentence.', is_recorded: false },
  { index: 3, text: 'Third sentence.', is_recorded: false },
];

const MEASURED_RUN = {
  model_file: 'ggml-base.en.bin',
  uses_prompt: false,
  measured_at_ms: 1,
  terms_found: 4,
  terms_total: 5,
  term_accuracy: 0.8,
  word_error_rate: 0.1,
  median_ms: 700,
  max_ms: 900,
  recordings: [],
};

export type FakeState = {
  settings: { model_file: string; keep_raw_audio: boolean; live_transcript: boolean };
  recorded: number[];
  runs: unknown[];
  engine: { server: string; failure: string | null; is_live_transcript_available: boolean };
  failSaving: boolean;
};

export function makeState(): FakeState {
  return {
    settings: { model_file: 'ggml-base.en.bin', keep_raw_audio: false, live_transcript: true },
    recorded: [],
    runs: [],
    engine: { server: 'ready', failure: null, is_live_transcript_available: true },
    failSaving: false,
  };
}

function checkOf(state: FakeState) {
  return {
    sentences: SENTENCES.map((sentence) => ({
      ...sentence,
      is_recorded: state.recorded.includes(sentence.index),
    })),
    results: { runs: state.runs },
  };
}

function modelsOf() {
  return {
    models: [
      { file: 'ggml-base.en.bin', size_bytes: 150 * 1024 * 1024 },
      { file: 'ggml-small.en.bin', size_bytes: 480 * 1024 * 1024 },
    ],
    override_path: null,
  };
}

function reject(command: string) {
  return Effect.fail(new IpcDecodeError({ command, cause: 'rejected' }));
}

function invokeText(state: FakeState, command: string, args: Record<string, unknown>) {
  switch (command) {
    case 'get_speech_settings':
      return Effect.succeed(state.settings);
    case 'list_speech_models':
      return Effect.succeed(modelsOf());
    case 'get_speech_check':
      return Effect.succeed(checkOf(state));
    case 'get_speech_engine_status':
      return Effect.succeed(state.engine);
    case 'save_speech_model':
      state.settings = { ...state.settings, model_file: String(args.model_file) };
      return Effect.succeed(state.settings);
    case 'save_live_transcript':
      state.settings = { ...state.settings, live_transcript: args.live_transcript === true };
      return Effect.succeed(state.settings);
    case 'delete_speech_check_recordings':
      state.recorded = [];
      return Effect.succeed(checkOf(state));
    case 'run_speech_check': {
      const channel = args.on_progress as { onmessage: (event: unknown) => void };
      channel.onmessage({ model_file: 'ggml-base.en.bin', uses_prompt: false, done: 1, total: 2 });
      state.runs = [MEASURED_RUN];
      return Effect.succeed({ runs: state.runs });
    }
    default:
      return reject(command);
  }
}

export type FakeClip = {
  readonly durationMs: number;
};

export function makeFakes(state: FakeState, clip: () => FakeClip) {
  const saved: Array<{ index: string | undefined; size: number }> = [];
  const phase = Effect.runSync(SubscriptionRef.make<ClipPhase>(IDLE_CLIP));
  const ipc = Layer.succeed(Ipc, {
    invoke: (command, args) => invokeText(state, command, args ?? {}),
  });
  const binary = Layer.succeed(IpcBinary, {
    invoke: (command, bytes, headers) => {
      if (command !== 'save_speech_check_recording' || state.failSaving) return reject(command);
      const index = Number(headers?.['x-sentence-index']);
      saved.push({ index: headers?.['x-sentence-index'], size: bytes.length });
      state.recorded = [...state.recorded, index];
      return Effect.succeed(checkOf(state));
    },
  });
  const recorder = Layer.succeed(ClipRecorder, {
    phase,
    stop: Effect.void,
    record: () => {
      const next = clip();
      const recorded: RecordedClip = {
        wav: new Blob(['wav']),
        durationMs: next.durationMs,
        signal: { capturedMs: next.durationMs, elapsedMs: next.durationMs, windows: [] },
        input: INPUT,
      };
      return Effect.succeed(recorded);
    },
  });
  const speech = Layer.mergeAll(
    Layer.fresh(SpeechRecognition.layer),
    Layer.fresh(SpeechRecognitionSettings.layer),
  ).pipe(Layer.provide(Layer.mergeAll(ipc, binary)));
  const feature = Layer.fresh(SentenceRecording.layer).pipe(
    Layer.provideMerge(speech),
    Layer.provide(recorder),
    Layer.provideMerge(Reactivity.layer),
  );
  return { feature, recorder, saved };
}
