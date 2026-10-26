import { Schema } from 'effect';
import type { RescueKind } from '../bindings/RescueKind';
import type { RescueRequest } from '../bindings/RescueRequest';
import type { RescueResponse } from '../bindings/RescueResponse';
import { bindingSchema } from './binding-schema';

export const RescueKindSchema = bindingSchema<RescueKind>()(
  Schema.Literals(['next_step', 'simpler', 'missing_word']),
);

export const RescueRequestSchema = bindingSchema<RescueRequest>()(
  Schema.Struct({
    kind: RescueKindSchema,
    question: Schema.String,
    partial_transcript: Schema.String,
    description: Schema.String,
  }),
);

export const RescueResponseSchema = bindingSchema<RescueResponse>()(
  Schema.Union([
    Schema.Struct({ kind: Schema.Literal('next_step'), suggestion: Schema.String }),
    Schema.Struct({ kind: Schema.Literal('simpler'), suggestion: Schema.String }),
    Schema.Struct({
      kind: Schema.Literal('missing_word'),
      candidates: Schema.Array(Schema.String),
    }),
  ]),
);
