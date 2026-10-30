import { Schema } from 'effect';
import type { DiagnosticEvent } from '../bindings/DiagnosticEvent';
import { bindingSchema } from './binding-schema';

export const DiagnosticEventSchema = bindingSchema<DiagnosticEvent>()(
  Schema.Struct({
    kind: Schema.Literal('natural_voice_fallback'),
    reason: Schema.Literals([
      'guard_timeout',
      'engine_busy',
      'output_failed_to_open',
      'synthesis_failed',
      'enqueue_failed',
    ]),
    phrase_chars: Schema.Int,
    guard_ms: Schema.Int,
    elapsed_ms: Schema.NullOr(Schema.Int),
    is_first_phrase: Schema.Boolean,
  }),
);
