import { Schema } from 'effect';
import type { FocusCategory } from '../bindings/FocusCategory';
import type { LearningItemType } from '../bindings/LearningItemType';
import type { LearningMemoryView } from '../bindings/LearningMemoryView';
import type { LearningStatus } from '../bindings/LearningStatus';
import type { MemoryUsageEvidence } from '../bindings/MemoryUsageEvidence';
import type { MistakeRecord } from '../bindings/MistakeRecord';
import type { PhraseCardRecord } from '../bindings/PhraseCardRecord';
import type { PhraseKind } from '../bindings/PhraseKind';
import type { UsageEventRecord } from '../bindings/UsageEventRecord';
import type { UsageOutcome } from '../bindings/UsageOutcome';
import { bindingSchema } from './binding-schema';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const LearningStatusSchema = bindingSchema<LearningStatus>()(
  Schema.Literals(['new', 'learning', 'improving', 'stable', 'archived']),
);

export const LearningItemTypeSchema = bindingSchema<LearningItemType>()(
  Schema.Literals(['mistake', 'phrase']),
);

export const FocusCategorySchema = bindingSchema<FocusCategory>()(
  Schema.Literals(['grammar', 'vocabulary', 'coherence', 'interaction']),
);

export const UsageOutcomeSchema = bindingSchema<UsageOutcome>()(
  Schema.Literals(['correct', 'with_help', 'incorrect', 'uncertain']),
);

const PhraseKindSchema = bindingSchema<PhraseKind>()(
  Schema.Literals(['phrase', 'phrasal_verb', 'linking_phrase', 'pattern']),
);

const MistakeRecordSchema = bindingSchema<MistakeRecord>()(
  Schema.Struct({
    id: Schema.Int,
    normalized_key: Schema.String,
    category: FocusCategorySchema,
    original_example: Schema.String,
    corrected_example: Schema.String,
    explanation: Schema.String,
    times_seen: Count,
    times_correct_afterwards: Count,
    last_seen_at: Schema.Int,
    last_reviewed_at: Schema.NullOr(Schema.Int),
    next_review_at: Schema.Int,
    interval_days: Count,
    ease_factor: Schema.Number,
    status: LearningStatusSchema,
    is_due: Schema.Boolean,
  }),
);

export const PhraseCardRecordSchema = bindingSchema<PhraseCardRecord>()(
  Schema.Struct({
    id: Schema.Int,
    phrase: Schema.String,
    kind: PhraseKindSchema,
    normalized_phrase: Schema.String,
    meaning_or_note: Schema.String,
    session_id: Schema.NullOr(Schema.Int),
    sequence: Schema.NullOr(Schema.Int),
    session_topic: Schema.optionalKey(Schema.String),
    created_at: Schema.Int,
    last_reviewed_at: Schema.NullOr(Schema.Int),
    next_review_at: Schema.Int,
    interval_days: Count,
    ease_factor: Schema.Number,
    status: LearningStatusSchema,
    is_due: Schema.Boolean,
    times_used_on_own: Count,
  }),
);

export const LearningMemoryViewSchema = bindingSchema<LearningMemoryView>()(
  Schema.Struct({
    mistakes: Schema.Array(MistakeRecordSchema),
    phrase_cards: Schema.Array(PhraseCardRecordSchema),
    due_count: Count,
  }),
);

const UsageEventRecordSchema = bindingSchema<UsageEventRecord>()(
  Schema.Struct({
    id: Schema.Int,
    item_type: LearningItemTypeSchema,
    item_id: Schema.Int,
    session_id: Schema.Int,
    sequence: Count,
    origin: Schema.String,
    original_turn_time: Schema.Int,
    outcome: UsageOutcomeSchema,
    exact_excerpt: Schema.String,
    confidence: Schema.Number,
    created_at: Schema.Int,
  }),
);

export const MemoryUsageEvidenceSchema = bindingSchema<MemoryUsageEvidence>()(
  Schema.Struct({
    item_type: LearningItemTypeSchema,
    item_id: Schema.Int,
    distinct_session_count: Count,
    streak: Count,
    events: Schema.Array(UsageEventRecordSchema),
  }),
);
