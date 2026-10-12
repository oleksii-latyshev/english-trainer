import { Schema, SchemaGetter } from 'effect';
import { withFallback } from '@/shared/schema/with-fallback';
import { DEFAULT_GROWTH, type GrowthPreference } from '../../preferences';

const GrowthFields = Schema.Struct({
  showGrowth: withFallback(Schema.Boolean, DEFAULT_GROWTH.showGrowth),
});

function asFields(value: unknown): (typeof GrowthFields)['Encoded'] {
  const isRecord = typeof value === 'object' && value !== null && !Array.isArray(value);
  return isRecord ? value : {};
}

export const GrowthSchema = Schema.Unknown.pipe(
  Schema.decodeTo(GrowthFields, {
    decode: SchemaGetter.transform(asFields),
    encode: SchemaGetter.passthrough(),
  }),
);

export const decodeGrowth: (value: unknown) => GrowthPreference =
  Schema.decodeUnknownSync(GrowthSchema);
