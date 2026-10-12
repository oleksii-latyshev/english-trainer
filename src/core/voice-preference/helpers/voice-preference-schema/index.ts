import { Schema, SchemaGetter } from 'effect';
import { withFallback } from '@/shared/schema/with-fallback';
import {
  DEFAULT_NATURAL_VOICE,
  DEFAULT_SPEECH_VOICE,
  NATURAL_VOICE_IDS,
  type NaturalVoicePreference,
  SPEECH_RATE_RANGE,
  type SpeechVoicePreference,
} from '../../voice-preference';

const clampedRate = Schema.Finite.pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform((rate: number) =>
      Math.min(SPEECH_RATE_RANGE.max, Math.max(SPEECH_RATE_RANGE.min, rate)),
    ),
    encode: SchemaGetter.passthrough(),
  }),
);

const voiceURI = Schema.NullOr(Schema.String).pipe(
  Schema.decodeTo(Schema.NullOr(Schema.String), {
    decode: SchemaGetter.transform((uri: string | null) => (uri === '' ? null : uri)),
    encode: SchemaGetter.passthrough(),
  }),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const NaturalVoiceFields = Schema.Struct({
  engine: withFallback(Schema.Literals(['natural', 'system']), DEFAULT_NATURAL_VOICE.engine),
  voiceId: withFallback(Schema.Literals(NATURAL_VOICE_IDS), DEFAULT_NATURAL_VOICE.voiceId),
});

const SpeechVoiceFields = Schema.Struct({
  voiceURI: withFallback(voiceURI, DEFAULT_SPEECH_VOICE.voiceURI),
  rate: withFallback(clampedRate, DEFAULT_SPEECH_VOICE.rate),
});

function naturalFields(value: unknown): (typeof NaturalVoiceFields)['Encoded'] {
  return isRecord(value) ? value : {};
}

function speechFields(value: unknown): (typeof SpeechVoiceFields)['Encoded'] {
  return isRecord(value) ? value : {};
}

export const NaturalVoiceSchema = Schema.Unknown.pipe(
  Schema.decodeTo(NaturalVoiceFields, {
    decode: SchemaGetter.transform(naturalFields),
    encode: SchemaGetter.passthrough(),
  }),
);

export const SpeechVoiceSchema = Schema.Unknown.pipe(
  Schema.decodeTo(SpeechVoiceFields, {
    decode: SchemaGetter.transform(speechFields),
    encode: SchemaGetter.passthrough(),
  }),
);

export const decodeNaturalVoice: (value: unknown) => NaturalVoicePreference =
  Schema.decodeUnknownSync(NaturalVoiceSchema);

export const decodeSpeechVoice: (value: unknown) => SpeechVoicePreference =
  Schema.decodeUnknownSync(SpeechVoiceSchema);
