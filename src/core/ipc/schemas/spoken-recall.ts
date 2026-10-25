import { Schema } from 'effect';
import type { DailyRecallItem } from '../bindings/DailyRecallItem';
import type { DailyRecallPlan } from '../bindings/DailyRecallPlan';
import type { SpokenRecallResult } from '../bindings/SpokenRecallResult';
import { bindingSchema } from './binding-schema';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Identifier = Schema.Int.check(Schema.isGreaterThan(0));

export const DailyRecallItemSchema = bindingSchema<DailyRecallItem>()(
  Schema.Struct({ phrase_id: Identifier, cue: Schema.String }),
);

export const DailyRecallPlanSchema = bindingSchema<DailyRecallPlan>()(
  Schema.Struct({ items: Schema.Array(DailyRecallItemSchema), completed_count: Count }),
);

export const SpokenRecallResultSchema = bindingSchema<SpokenRecallResult>()(
  Schema.Struct({
    phrase_id: Identifier,
    transcript: Schema.String,
    target: Schema.String,
    wording_observed: Schema.Boolean,
  }),
);
