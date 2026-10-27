import { Schema } from 'effect';
import type { RescueResponse } from '../bindings/RescueResponse';
import { bindingSchema } from './binding-schema';

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
