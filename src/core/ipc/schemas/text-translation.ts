import { Schema } from 'effect';
import type { TextExplanation } from '../bindings/TextExplanation';
import type { TextTranslation } from '../bindings/TextTranslation';
import type { TranslationRequest } from '../bindings/TranslationRequest';
import { bindingSchema } from './binding-schema';

export const TranslationRequestSchema = bindingSchema<TranslationRequest>()(
  Schema.Struct({ text: Schema.String, context: Schema.String }),
);

export const TextTranslationSchema = bindingSchema<TextTranslation>()(
  Schema.Struct({
    text: Schema.String,
    native_language: Schema.String,
    translation: Schema.String,
  }),
);

export const TextExplanationSchema = bindingSchema<TextExplanation>()(
  Schema.Struct({ text: Schema.String, english_explanation: Schema.String }),
);
