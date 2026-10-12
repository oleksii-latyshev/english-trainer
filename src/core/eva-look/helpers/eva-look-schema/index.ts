import { Schema, SchemaGetter } from 'effect';
import { withFallback } from '@/shared/schema/with-fallback';
import {
  BODY_COLOURS,
  DEFAULT_EVA_LOOK,
  EVA_MOTIONS,
  type EvaLook,
  INK_COLOURS,
  LEAF_COLOURS,
  PETAL_COLOURS,
} from '../../palette';

const LEGACY_BODY_IDS: Readonly<Record<string, unknown>> = { pearl: 'cloud' };

type Option = { readonly id: string; readonly lockedHint?: string };

function selectableIds<T extends Option>(options: readonly T[]): T['id'][] {
  return options.filter((option) => option.lockedHint === undefined).map((option) => option.id);
}

function field<Id extends string>(options: readonly Option[], fallback: Id) {
  return withFallback(Schema.Literals(selectableIds(options) as Id[]), fallback);
}

const EvaLookFields = Schema.Struct({
  body: field(BODY_COLOURS, DEFAULT_EVA_LOOK.body),
  ink: field(INK_COLOURS, DEFAULT_EVA_LOOK.ink),
  leaf: field(LEAF_COLOURS, DEFAULT_EVA_LOOK.leaf),
  petal: field(PETAL_COLOURS, DEFAULT_EVA_LOOK.petal),
  motion: field(EVA_MOTIONS, DEFAULT_EVA_LOOK.motion),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type StoredFields = (typeof EvaLookFields)['Encoded'];

function renameLegacyFields(value: unknown): StoredFields {
  if (!isRecord(value)) return {};
  const body = value.body ?? value.sphere;
  const renamed = {
    ...value,
    body: typeof body === 'string' && body in LEGACY_BODY_IDS ? LEGACY_BODY_IDS[body] : body,
    ink: value.ink ?? value.eye,
  };
  return renamed as StoredFields;
}

export const EvaLookSchema = Schema.Unknown.pipe(
  Schema.decodeTo(EvaLookFields, {
    decode: SchemaGetter.transform(renameLegacyFields),
    encode: SchemaGetter.passthrough(),
  }),
);

export const decodeEvaLook: (value: unknown) => EvaLook = Schema.decodeUnknownSync(EvaLookSchema);
