import { Schema } from 'effect';
import type { AnswerPlan } from '../bindings/AnswerPlan';
import { bindingSchema } from './binding-schema';

export const AnswerPlanSchema = bindingSchema<AnswerPlan>()(
  Schema.Struct({
    frame: Schema.Array(Schema.String),
    phrases: Schema.Array(Schema.String),
    model_answer: Schema.String,
    adaptation: Schema.String,
  }),
);
