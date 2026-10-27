import { Schema } from 'effect';
import type { NativeLanguageSettings } from '../bindings/NativeLanguageSettings';
import type { TranslationStatus } from '../bindings/TranslationStatus';
import type { TranslationStatusKind } from '../bindings/TranslationStatusKind';
import { bindingSchema } from './binding-schema';

export const NativeLanguageSettingsSchema = bindingSchema<NativeLanguageSettings>()(
  Schema.Struct({ native_language: Schema.String }),
);

const TranslationStatusKindSchema = bindingSchema<TranslationStatusKind>()(
  Schema.Literals(['installed', 'download_required', 'unsupported', 'unavailable']),
);

export const TranslationStatusSchema = bindingSchema<TranslationStatus>()(
  Schema.Struct({
    native_language: Schema.String,
    status: TranslationStatusKindSchema,
    message: Schema.String,
  }),
);
