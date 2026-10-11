import { Schema } from 'effect';
import type { GeminiKeyStatus } from '../bindings/GeminiKeyStatus';
import type { KeySource } from '../bindings/KeySource';
import { bindingSchema } from './binding-schema';

export const KeySourceSchema = bindingSchema<KeySource>()(
  Schema.Literals(['settings', 'environment']),
);

export const GeminiKeyStatusSchema = bindingSchema<GeminiKeyStatus>()(
  Schema.Struct({
    configured: Schema.Boolean,
    source: Schema.NullOr(KeySourceSchema),
  }),
);
