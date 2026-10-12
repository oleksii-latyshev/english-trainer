import { Schema, SchemaGetter } from 'effect';
import { withFallback } from '@/shared/schema/with-fallback';
import { type Appearance, DEFAULT_APPEARANCE, THEME_OPTIONS } from '../../theme';

const AppearanceFields = Schema.Struct({
  theme: withFallback(
    Schema.Literals(THEME_OPTIONS.map((option) => option.value)),
    DEFAULT_APPEARANCE.theme,
  ),
});

function asFields(value: unknown): (typeof AppearanceFields)['Encoded'] {
  const isRecord = typeof value === 'object' && value !== null && !Array.isArray(value);
  return isRecord ? value : {};
}

export const AppearanceSchema = Schema.Unknown.pipe(
  Schema.decodeTo(AppearanceFields, {
    decode: SchemaGetter.transform(asFields),
    encode: SchemaGetter.passthrough(),
  }),
);

export const decodeAppearance: (value: unknown) => Appearance =
  Schema.decodeUnknownSync(AppearanceSchema);
