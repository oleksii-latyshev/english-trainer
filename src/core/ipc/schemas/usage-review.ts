import { Schema } from 'effect';
import type { TurnUsageAssessment } from '../bindings/TurnUsageAssessment';
import type { UsageAssessmentFinding } from '../bindings/UsageAssessmentFinding';
import { bindingSchema } from './binding-schema';
import { LearningItemTypeSchema, LearningStatusSchema, UsageOutcomeSchema } from './learning';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Identifier = Schema.Int.check(Schema.isGreaterThan(0));

export const UsageAssessmentFindingSchema = bindingSchema<UsageAssessmentFinding>()(
  Schema.Struct({
    item_type: LearningItemTypeSchema,
    item_id: Identifier,
    target: Schema.String,
    outcome: UsageOutcomeSchema,
    confidence: Schema.Number,
    exact_excerpt: Schema.String,
    credited: Schema.Boolean,
    status_after: LearningStatusSchema,
  }),
);

export const TurnUsageAssessmentSchema = bindingSchema<TurnUsageAssessment>()(
  Schema.Struct({
    session_id: Identifier,
    sequence: Identifier,
    assessed_at: Count,
    findings: Schema.Array(UsageAssessmentFindingSchema),
  }),
);
