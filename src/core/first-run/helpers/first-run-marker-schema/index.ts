import { Schema, SchemaGetter } from 'effect';
import { withFallback } from '@/shared/schema/with-fallback';
import { FIRST_RUN_STATUSES, type FirstRunMarker, PENDING_MARKER } from '../../first-run';

const MarkerFields = Schema.Struct({
  status: withFallback(Schema.Literals(FIRST_RUN_STATUSES), PENDING_MARKER.status),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function markerFields(value: unknown): (typeof MarkerFields)['Encoded'] {
  return isRecord(value) ? value : {};
}

export const FirstRunMarkerSchema = Schema.Unknown.pipe(
  Schema.decodeTo(MarkerFields, {
    decode: SchemaGetter.transform(markerFields),
    encode: SchemaGetter.passthrough(),
  }),
);

export const decodeFirstRunMarker: (value: unknown) => FirstRunMarker =
  Schema.decodeUnknownSync(FirstRunMarkerSchema);
