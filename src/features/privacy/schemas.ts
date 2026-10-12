import { Schema } from 'effect';

export const SpeechRetentionSchema = Schema.Struct({ keep_raw_audio: Schema.Boolean });

export const KeptRecordingsSchema = Schema.Struct({
  count: Schema.Number,
  size_bytes: Schema.Number,
});
