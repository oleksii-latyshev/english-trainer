import { Schema } from 'effect';
import type { AgyModel } from '../bindings/AgyModel';
import type { AiSettings } from '../bindings/AiSettings';
import type { ConversationProvider } from '../bindings/ConversationProvider';
import type { EvaStyle } from '../bindings/EvaStyle';
import { bindingSchema } from './binding-schema';

const ConversationProviderSchema = bindingSchema<ConversationProvider>()(
  Schema.Literals(['gemini', 'apple', 'agy']),
);

const AgyModelSchema = bindingSchema<AgyModel>()(
  Schema.Literals(['default', 'gemini-3.8-flash-low', 'gemini-3.8-flash-high']),
);

const EvaStyleSchema = bindingSchema<EvaStyle>()(Schema.Literals(['short_and_simple', 'natural']));

export const AiSettingsSchema = bindingSchema<AiSettings>()(
  Schema.Struct({
    provider: ConversationProviderSchema,
    agy_model: AgyModelSchema,
    eva_style: EvaStyleSchema,
  }),
);
