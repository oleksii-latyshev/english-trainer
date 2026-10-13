import { Duration, Effect, Option, Schedule, Stream } from 'effect';
import { AsyncResult, Atom } from 'effect/reactivity';
import { audioAtomContext, clipPhaseAtom, IDLE_CLIP } from '@/core/audio';
import type { SpeechCheckProgress } from '@/core/ipc';
import { SpeechRecognition, SpeechRecognitionSettings } from '@/core/speech';
import { sentenceRecorderState } from '../helpers/sentence-recorder';
import { nextSentenceIndex } from '../helpers/speech-check';
import { SentenceRecording } from '../services/sentence-recording-service';
import { runtime } from './runtime';

const SETTINGS = ['speech-recognition-settings'];
const CHECK = ['speech-check'];
const ENGINE_REFRESH = Duration.millis(1500);

export type SentenceRequest = { readonly index: number; readonly deviceId: string };
export type MeasureRequest = {
  readonly modelFiles: readonly string[];
  readonly includePrompt: boolean;
};

export const speechSettingsAtom = runtime
  .atom(
    Effect.gen(function* () {
      const settings = yield* SpeechRecognitionSettings;
      return yield* settings.settings;
    }),
  )
  .pipe(audioAtomContext.withReactivity(SETTINGS));

export const speechModelsAtom = runtime.atom(
  Effect.gen(function* () {
    const settings = yield* SpeechRecognitionSettings;
    return yield* settings.models;
  }),
);

export const speechCheckAtom = runtime
  .atom(
    Effect.gen(function* () {
      const settings = yield* SpeechRecognitionSettings;
      return yield* settings.speechCheck;
    }),
  )
  .pipe(audioAtomContext.withReactivity(CHECK));

export const engineStatusAtom = runtime.atom((get) => {
  get(speechSettingsAtom);
  return Stream.unwrap(
    Effect.gen(function* () {
      const recognition = yield* SpeechRecognition;
      return Stream.fromEffectSchedule(
        recognition.engineStatus.pipe(Effect.option),
        Schedule.spaced(ENGINE_REFRESH),
      ).pipe(
        Stream.filter(Option.isSome),
        Stream.map((status) => status.value),
      );
    }),
  );
});

export const saveSpeechModelAtom = runtime.fn(
  Effect.fn('saveSpeechModel')(function* (modelFile: string) {
    const settings = yield* SpeechRecognitionSettings;
    yield* settings.saveModel(modelFile);
  }),
  { reactivityKeys: SETTINGS },
);

export const saveLiveTranscriptAtom = runtime.fn(
  Effect.fn('saveLiveTranscript')(function* (isOn: boolean) {
    const settings = yield* SpeechRecognitionSettings;
    yield* settings.saveLiveTranscript(isOn);
  }),
  { reactivityKeys: SETTINGS },
);

export const selectedSentenceAtom = Atom.make<number | undefined>(undefined);

const savingAtom = Atom.make(false);

export const recordSentenceAtom = runtime.fn(
  Effect.fn('recordSentence')(function* (request: SentenceRequest, get: Atom.FnContext) {
    const sentences = yield* SentenceRecording;
    const settings = yield* SpeechRecognitionSettings;
    const record = Effect.gen(function* () {
      const clip = yield* sentences.record(request.deviceId);
      get.set(savingAtom, true);
      const status = yield* settings.saveSpeechCheckRecording(request.index, clip.wav);
      get.set(selectedSentenceAtom, nextSentenceIndex(status.sentences, request.index));
    });
    yield* record.pipe(Effect.ensuring(Effect.sync(() => get.set(savingAtom, false))));
  }),
  { reactivityKeys: CHECK },
);

export const sentenceRecorderAtom = Atom.make((get) =>
  sentenceRecorderState({
    phase: AsyncResult.getOrElse(get(clipPhaseAtom), () => IDLE_CLIP),
    run: get(recordSentenceAtom),
    isSaving: get(savingAtom),
  }),
);

export const deleteSpeechCheckRecordingsAtom = runtime.fn(
  Effect.fn('deleteSpeechCheckRecordings')(function* (_: undefined, get: Atom.FnContext) {
    const settings = yield* SpeechRecognitionSettings;
    yield* settings.deleteSpeechCheckRecordings;
    get.set(selectedSentenceAtom, 1);
  }),
  { reactivityKeys: CHECK },
);

export const measurementProgressAtom = Atom.make<Option.Option<SpeechCheckProgress>>(Option.none());

export const measureModelsAtom = runtime.fn(
  Effect.fn('measureModels')(function* (request: MeasureRequest, get: Atom.FnContext) {
    const settings = yield* SpeechRecognitionSettings;
    get.set(measurementProgressAtom, Option.none());
    const measure = settings.runSpeechCheck(request.modelFiles, request.includePrompt, (progress) =>
      get.set(measurementProgressAtom, Option.some(progress)),
    );
    yield* measure.pipe(
      Effect.ensuring(Effect.sync(() => get.set(measurementProgressAtom, Option.none()))),
    );
  }),
  { reactivityKeys: CHECK },
);
