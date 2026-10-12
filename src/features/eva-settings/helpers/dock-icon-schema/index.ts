import { Schema, SchemaGetter } from 'effect';
import { withFallback } from '@/shared/schema/with-fallback';
import { DEFAULT_DOCK_ICON, DOCK_ICONS, type DockIconPreference } from '../../preferences';

const DockIconFields = Schema.Struct({
  icon: withFallback(
    Schema.Literals(DOCK_ICONS.map((option) => option.value)),
    DEFAULT_DOCK_ICON.icon,
  ),
});

function asFields(value: unknown): (typeof DockIconFields)['Encoded'] {
  const isRecord = typeof value === 'object' && value !== null && !Array.isArray(value);
  return isRecord ? value : {};
}

export const DockIconSchema = Schema.Unknown.pipe(
  Schema.decodeTo(DockIconFields, {
    decode: SchemaGetter.transform(asFields),
    encode: SchemaGetter.passthrough(),
  }),
);

export const decodeDockIcon: (value: unknown) => DockIconPreference =
  Schema.decodeUnknownSync(DockIconSchema);
