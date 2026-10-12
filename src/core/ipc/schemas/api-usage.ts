import { Schema } from 'effect';
import type { AntigravityUsage } from '../bindings/AntigravityUsage';
import type { ApiUsageOverview } from '../bindings/ApiUsageOverview';
import type { GeminiUsage } from '../bindings/GeminiUsage';
import type { LimitNote } from '../bindings/LimitNote';
import type { ModelRequests } from '../bindings/ModelRequests';
import { bindingSchema } from './binding-schema';

export const LimitNoteSchema = bindingSchema<LimitNote>()(
  Schema.Struct({
    occurred_at_ms: Schema.Int,
    model: Schema.String,
    message: Schema.String,
    resets_at_ms: Schema.NullOr(Schema.Int),
  }),
);

export const ModelRequestsSchema = bindingSchema<ModelRequests>()(
  Schema.Struct({
    model: Schema.String,
    requests: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  }),
);

export const GeminiUsageSchema = bindingSchema<GeminiUsage>()(
  Schema.Struct({
    models: Schema.Array(ModelRequestsSchema),
    last_limit: Schema.NullOr(LimitNoteSchema),
    resets_at_ms: Schema.Int,
  }),
);

export const AntigravityUsageSchema = bindingSchema<AntigravityUsage>()(
  Schema.Struct({
    requests_today: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    last_quota_error: Schema.NullOr(LimitNoteSchema),
  }),
);

export const ApiUsageOverviewSchema = bindingSchema<ApiUsageOverview>()(
  Schema.Struct({
    day: Schema.String,
    gemini: GeminiUsageSchema,
    antigravity: AntigravityUsageSchema,
  }),
);
