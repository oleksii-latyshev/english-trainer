import { Schema } from 'effect';
import type { ContrastLine } from '../bindings/ContrastLine';
import type { LessonState } from '../bindings/LessonState';
import type { LessonView } from '../bindings/LessonView';
import type { LessonWord } from '../bindings/LessonWord';
import type { MistakeDetail } from '../bindings/MistakeDetail';
import type { MistakeGroup } from '../bindings/MistakeGroup';
import type { MistakeGroups } from '../bindings/MistakeGroups';
import type { MistakeRule } from '../bindings/MistakeRule';
import type { MistakeSummary } from '../bindings/MistakeSummary';
import type { MistakesUpdated } from '../bindings/MistakesUpdated';
import type { RuleCardView } from '../bindings/RuleCardView';
import type { RuleKey } from '../bindings/RuleKey';
import { bindingSchema } from './binding-schema';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const MISTAKES_UPDATED_EVENT = 'mistakes-updated';

const RuleKeySchema = bindingSchema<RuleKey>()(
  Schema.Literals([
    'past_simple_vs_present_perfect',
    'past_perfect',
    'present_simple_vs_continuous',
    'future_forms',
    'conditionals',
    'subject_verb_agreement',
    'articles',
    'prepositions',
    'question_word_order',
    'embedded_question_order',
    'word_order',
    'plural_and_countable',
    'comparatives',
    'gerund_vs_infinitive',
    'modal_verbs',
    'word_choice',
    'collocation',
    'other',
  ]),
);

const LessonStateSchema = bindingSchema<LessonState>()(
  Schema.Literals(['pending', 'ready', 'failed']),
);

const ContrastLineSchema = bindingSchema<ContrastLine>()(
  Schema.Struct({ label: Schema.String, sentence: Schema.String }),
);

const LessonWordSchema = bindingSchema<LessonWord>()(
  Schema.Struct({ word: Schema.String, meaning: Schema.String }),
);

const LessonViewSchema = bindingSchema<LessonView>()(
  Schema.Struct({
    explanation: Schema.String,
    contrast: Schema.Array(ContrastLineSchema),
    examples: Schema.Array(Schema.String),
    word: Schema.NullOr(LessonWordSchema),
  }),
);

const MistakeRuleSchema = bindingSchema<MistakeRule>()(
  Schema.Struct({ rule_key: RuleKeySchema, title: Schema.String }),
);

const MistakeSummarySchema = bindingSchema<MistakeSummary>()(
  Schema.Struct({
    id: Schema.Int,
    said: Schema.String,
    corrected: Schema.String,
    rule_key: Schema.NullOr(RuleKeySchema),
    lesson_state: LessonStateSchema,
    ladder_step: Count,
    is_fixed: Schema.Boolean,
    is_due: Schema.Boolean,
    last_seen_at: Schema.Int,
  }),
);

const MistakeGroupSchema = bindingSchema<MistakeGroup>()(
  Schema.Struct({
    rule_key: RuleKeySchema,
    title: Schema.String,
    summary: Schema.String,
    mistake_count: Count,
    fixed_count: Count,
    due_count: Count,
    relapse_count: Count,
    last_relapse_at: Schema.NullOr(Schema.Int),
    mistakes: Schema.Array(MistakeSummarySchema),
  }),
);

export const MistakeGroupsSchema = bindingSchema<MistakeGroups>()(
  Schema.Struct({
    groups: Schema.Array(MistakeGroupSchema),
    ungrouped: Schema.Array(MistakeSummarySchema),
    due_count: Count,
  }),
);

export const MistakeDetailSchema = bindingSchema<MistakeDetail>()(
  Schema.Struct({
    id: Schema.Int,
    question: Schema.String,
    said: Schema.String,
    corrected: Schema.String,
    review_explanation: Schema.String,
    session_id: Schema.NullOr(Schema.Int),
    sequence: Schema.NullOr(Schema.Int),
    last_seen_at: Schema.Int,
    ladder_step: Count,
    fixed_at: Schema.NullOr(Schema.Int),
    next_review_at: Schema.Int,
    is_due: Schema.Boolean,
    rule: Schema.NullOr(MistakeRuleSchema),
    lesson_state: LessonStateSchema,
    lesson: Schema.NullOr(LessonViewSchema),
  }),
);

export const RuleCardViewSchema = bindingSchema<RuleCardView>()(
  Schema.Struct({
    rule_key: RuleKeySchema,
    title: Schema.String,
    summary: Schema.String,
    body: Schema.NullOr(Schema.String),
    examples: Schema.Array(Schema.String),
  }),
);

export const MistakesUpdatedSchema = bindingSchema<MistakesUpdated>()(
  Schema.Struct({ lessons_ready: Count }),
);
