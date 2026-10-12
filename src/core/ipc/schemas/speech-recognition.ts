import { Schema } from 'effect';
import type { KeptRecordings } from '../bindings/KeptRecordings';
import type { ModelRun } from '../bindings/ModelRun';
import type { RecordingResult } from '../bindings/RecordingResult';
import type { SentenceStatus } from '../bindings/SentenceStatus';
import type { ServerState } from '../bindings/ServerState';
import type { SpeechCheckProgress } from '../bindings/SpeechCheckProgress';
import type { SpeechCheckResults } from '../bindings/SpeechCheckResults';
import type { SpeechCheckStatus } from '../bindings/SpeechCheckStatus';
import type { SpeechEngineStatus } from '../bindings/SpeechEngineStatus';
import type { SpeechModel } from '../bindings/SpeechModel';
import type { SpeechModels } from '../bindings/SpeechModels';
import type { SpeechSettings } from '../bindings/SpeechSettings';
import type { Transcript } from '../bindings/Transcript';
import { bindingSchema } from './binding-schema';

export const TranscriptSchema = bindingSchema<Transcript>()(
  Schema.Struct({
    text: Schema.String,
    language: Schema.String,
    duration_ms: Schema.Number,
  }),
);

export const SpeechSettingsSchema = bindingSchema<SpeechSettings>()(
  Schema.Struct({
    model_file: Schema.String,
    keep_raw_audio: Schema.Boolean,
    live_transcript: Schema.Boolean,
  }),
);

export const ServerStateSchema = bindingSchema<ServerState>()(
  Schema.Literals(['ready', 'loading', 'not_running']),
);

export const SpeechEngineStatusSchema = bindingSchema<SpeechEngineStatus>()(
  Schema.Struct({
    server: ServerStateSchema,
    failure: Schema.NullOr(Schema.String),
    is_live_transcript_available: Schema.Boolean,
  }),
);

export const SpeechModelSchema = bindingSchema<SpeechModel>()(
  Schema.Struct({ file: Schema.String, size_bytes: Schema.Number }),
);

export const SpeechModelsSchema = bindingSchema<SpeechModels>()(
  Schema.Struct({
    models: Schema.mutable(Schema.Array(SpeechModelSchema)),
    override_path: Schema.NullOr(Schema.String),
  }),
);

export const KeptRecordingsSchema = bindingSchema<KeptRecordings>()(
  Schema.Struct({ count: Schema.Number, size_bytes: Schema.Number }),
);

export const SentenceStatusSchema = bindingSchema<SentenceStatus>()(
  Schema.Struct({ index: Schema.Number, text: Schema.String, is_recorded: Schema.Boolean }),
);

export const RecordingResultSchema = bindingSchema<RecordingResult>()(
  Schema.Struct({
    index: Schema.Number,
    reference: Schema.String,
    transcript: Schema.String,
    time_ms: Schema.Number,
    terms_found: Schema.Number,
    terms_total: Schema.Number,
    word_error_rate: Schema.Number,
  }),
);

export const ModelRunSchema = bindingSchema<ModelRun>()(
  Schema.Struct({
    model_file: Schema.String,
    uses_prompt: Schema.Boolean,
    measured_at_ms: Schema.Number,
    terms_found: Schema.Number,
    terms_total: Schema.Number,
    term_accuracy: Schema.NullOr(Schema.Number),
    word_error_rate: Schema.Number,
    median_ms: Schema.Number,
    max_ms: Schema.Number,
    recordings: Schema.mutable(Schema.Array(RecordingResultSchema)),
  }),
);

export const SpeechCheckResultsSchema = bindingSchema<SpeechCheckResults>()(
  Schema.Struct({ runs: Schema.mutable(Schema.Array(ModelRunSchema)) }),
);

export const SpeechCheckStatusSchema = bindingSchema<SpeechCheckStatus>()(
  Schema.Struct({
    sentences: Schema.mutable(Schema.Array(SentenceStatusSchema)),
    results: SpeechCheckResultsSchema,
  }),
);

export const SpeechCheckProgressSchema = bindingSchema<SpeechCheckProgress>()(
  Schema.Struct({
    model_file: Schema.String,
    uses_prompt: Schema.Boolean,
    done: Schema.Number,
    total: Schema.Number,
  }),
);

export const PartialTranscriptSchema = Schema.NullOr(Schema.String);
