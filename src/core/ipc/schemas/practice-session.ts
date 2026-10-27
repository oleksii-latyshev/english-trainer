import { Schema } from 'effect';
import type { AttemptComparison } from '../bindings/AttemptComparison';
import type { FocusFeedback } from '../bindings/FocusFeedback';
import type { PracticeDialogue } from '../bindings/PracticeDialogue';
import type { PracticeMode } from '../bindings/PracticeMode';
import type { PracticePhase } from '../bindings/PracticePhase';
import type { PracticeSession } from '../bindings/PracticeSession';
import type { StoredTurn } from '../bindings/StoredTurn';
import type { TargetEvidence } from '../bindings/TargetEvidence';
import type { TurnCoaching } from '../bindings/TurnCoaching';
import type { TurnFeedback } from '../bindings/TurnFeedback';
import { bindingSchema } from './binding-schema';
import { AnsweredBySchema } from './conversation-turn';
import { FocusCategorySchema } from './learning';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Identifier = Schema.Int.check(Schema.isGreaterThan(0));

export const PracticeModeSchema = bindingSchema<PracticeMode>()(
  Schema.Literals(['voice', 'text_chat', 'write_then_speak']),
);

export const PracticePhaseSchema = bindingSchema<PracticePhase>()(
  Schema.Literals(['writing', 'writing_review', 'speaking', 'speaking_review']),
);

const TargetEvidenceSchema = bindingSchema<TargetEvidence>()(
  Schema.Literals([
    'already_present_in_both',
    'newly_observed_in_retry',
    'partially_observed',
    'not_observed',
    'uncertain',
  ]),
);

export const AttemptComparisonSchema = bindingSchema<AttemptComparison>()(
  Schema.Struct({
    turn_sequence: Identifier,
    original_transcript: Schema.String,
    retry_transcript: Schema.String,
    target: Schema.String,
    target_evidence: TargetEvidenceSchema,
    word_count_change: Schema.Int,
    hesitation: Schema.String,
  }),
);

export const PracticeSessionSchema = bindingSchema<PracticeSession>()(
  Schema.Struct({
    session_id: Identifier,
    opening_question: Schema.String,
    turn_count: Count,
    target_turns: Identifier,
    retry_evidence: Schema.Array(AttemptComparisonSchema),
    topic_id: Schema.String,
    topic_label: Schema.String,
    topic_custom: Schema.NullOr(Schema.String),
    duration_goal_seconds: Schema.NullOr(Count),
    active_duration_ms: Count,
    started_at: Count,
    is_clock_running: Schema.Boolean,
    practice_mode: PracticeModeSchema,
    practice_phase: PracticePhaseSchema,
    written_turn_count: Count,
    spoken_turn_count: Count,
    is_mistake_practice: Schema.Boolean,
  }),
);

const StoredTurnSchema = bindingSchema<StoredTurn>()(
  Schema.Struct({
    learner: Schema.String,
    assistant_reply: Schema.String,
    assistant_question: Schema.String,
    answered_by: Schema.NullOr(AnsweredBySchema),
  }),
);

const FocusFeedbackSchema = bindingSchema<FocusFeedback>()(
  Schema.Struct({
    category: FocusCategorySchema,
    original: Schema.String,
    improved: Schema.String,
    explanation: Schema.String,
  }),
);

export const TurnFeedbackSchema = bindingSchema<TurnFeedback>()(
  Schema.Struct({
    focus_feedback: Schema.Array(FocusFeedbackSchema),
    b2_rewrite: Schema.String,
  }),
);

export const TurnCoachingSchema = bindingSchema<TurnCoaching>()(
  Schema.Union([
    Schema.Struct({ state: Schema.Literal('pending') }),
    Schema.Struct({ state: Schema.Literal('paused') }),
    Schema.Struct({ state: Schema.Literal('failed') }),
    Schema.Struct({ state: Schema.Literal('ready'), feedback: TurnFeedbackSchema }),
  ]),
);

export const PracticeDialogueSchema = bindingSchema<PracticeDialogue>()(
  Schema.Struct({
    session_id: Identifier,
    opening_question: Schema.String,
    turns: Schema.Array(StoredTurnSchema),
    input_sources: Schema.Array(Schema.String),
    reply_times_ms: Schema.Array(Schema.NullOr(Count)),
    answer_durations_ms: Schema.Array(Schema.NullOr(Count)),
    help_used: Schema.Array(Schema.Boolean),
    coaching: Schema.Array(TurnCoachingSchema),
  }),
);

export const COACHING_UPDATED_EVENT = 'coaching-updated';

export const CoachingUpdatedSchema = Schema.Struct({ session_id: Identifier });
