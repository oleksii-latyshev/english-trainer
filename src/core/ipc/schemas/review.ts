import { Schema } from 'effect';
import type { MemoryRecallResult } from '../bindings/MemoryRecallResult';
import type { MemoryReviewItem } from '../bindings/MemoryReviewItem';
import type { MemoryReviewRun } from '../bindings/MemoryReviewRun';
import type { ReviewMaterials } from '../bindings/ReviewMaterials';
import type { ReviewMaterialView } from '../bindings/ReviewMaterialView';
import type { ReviewPreparation } from '../bindings/ReviewPreparation';
import type { ReviewResponse } from '../bindings/ReviewResponse';
import { bindingSchema } from './binding-schema';
import { IPC_ERROR_FIELDS } from './ipc-error';
import { LearningItemTypeSchema, LearningStatusSchema } from './learning';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const ReviewResponseSchema = bindingSchema<ReviewResponse>()(
  Schema.Literals(['remembered', 'need_practice']),
);

const MemoryReviewItemSchema = bindingSchema<MemoryReviewItem>()(
  Schema.Struct({
    position: Count,
    item_type: LearningItemTypeSchema,
    item_id: Schema.Int,
    cue: Schema.String,
    target: Schema.NullOr(Schema.String),
    transcript: Schema.NullOr(Schema.String),
    wording_observed: Schema.NullOr(Schema.Boolean),
    saved_response: Schema.NullOr(ReviewResponseSchema),
    next_review_at: Schema.NullOr(Schema.Int),
    interval_days: Schema.NullOr(Count),
    status: Schema.NullOr(LearningStatusSchema),
    is_skipped: Schema.Boolean,
  }),
);

export const MemoryReviewRunSchema = bindingSchema<MemoryReviewRun>()(
  Schema.Struct({
    run_id: Schema.Int,
    items: Schema.Array(MemoryReviewItemSchema),
    completed: Schema.Boolean,
  }),
);

export const MemoryRecallResultSchema = bindingSchema<MemoryRecallResult>()(
  Schema.Struct({
    run_id: Schema.Int,
    position: Count,
    item_type: LearningItemTypeSchema,
    item_id: Schema.Int,
    cue: Schema.String,
    target: Schema.String,
    transcript: Schema.String,
    wording_observed: Schema.Boolean,
    saved_response: ReviewResponseSchema,
    next_review_at: Schema.Int,
    interval_days: Count,
    status: LearningStatusSchema,
  }),
);

const ReviewPreparationSchema = bindingSchema<ReviewPreparation>()(
  Schema.Union([
    Schema.Struct({ state: Schema.Literal('legacy') }),
    Schema.Struct({ state: Schema.Literal('pending') }),
    Schema.Struct({ state: Schema.Literal('ready') }),
    Schema.Struct({ state: Schema.Literal('failed'), error: Schema.Struct(IPC_ERROR_FIELDS) }),
  ]),
);

const ReviewMaterialViewSchema = bindingSchema<ReviewMaterialView>()(
  Schema.Struct({
    position: Count,
    situation: Schema.NullOr(Schema.String),
    model_answer: Schema.NullOr(Schema.String),
    hint: Schema.NullOr(Schema.String),
    is_cued: Schema.Boolean,
  }),
);

export const ReviewMaterialsSchema = bindingSchema<ReviewMaterials>()(
  Schema.Struct({
    run_id: Schema.Int,
    preparation: ReviewPreparationSchema,
    items: Schema.Array(ReviewMaterialViewSchema),
  }),
);
