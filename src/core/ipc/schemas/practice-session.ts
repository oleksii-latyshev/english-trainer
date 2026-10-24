import { Schema } from 'effect';
import type { AttemptComparison } from '../bindings/AttemptComparison';
import type { PracticeDialogue } from '../bindings/PracticeDialogue';
import type { PracticeMode } from '../bindings/PracticeMode';
import type { PracticePhase } from '../bindings/PracticePhase';
import type { PracticeSession } from '../bindings/PracticeSession';
import type { StoredTurn } from '../bindings/StoredTurn';
import type { TargetEvidence } from '../bindings/TargetEvidence';
import { bindingSchema } from './binding-schema';
import { AnsweredBySchema } from './conversation-turn';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Identifier = Schema.Int.check(Schema.isGreaterThan(0));

export const PracticeModeSchema = bindingSchema<PracticeMode>()(
  Schema.Literals(['voice', 'text_chat', 'write_then_speak']),
);

export const PracticePhaseSchema = bindingSchema<PracticePhase>()(
  Schema.Literals(['writing', 'writing_review', 'speaking', 'speaking_review']),
);

export const TargetEvidenceSchema = bindingSchema<TargetEvidence>()(
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
    duration_goal_seconds: Count,
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

export const FinishedSessionSchema = Schema.Record(Schema.String, Schema.Unknown);

export const StoredTurnSchema = bindingSchema<StoredTurn>()(
  Schema.Struct({
    learner: Schema.String,
    assistant_reply: Schema.String,
    assistant_question: Schema.String,
    answered_by: Schema.NullOr(AnsweredBySchema),
  }),
);

type PracticeDialogueWithoutCoaching = {
  [Key in keyof PracticeDialogue]: Key extends 'coaching' ? unknown[] : PracticeDialogue[Key];
};

export const PracticeDialogueSchema = bindingSchema<PracticeDialogueWithoutCoaching>()(
  Schema.Struct({
    session_id: Identifier,
    opening_question: Schema.String,
    turns: Schema.Array(StoredTurnSchema),
    input_sources: Schema.Array(Schema.String),
    reply_times_ms: Schema.Array(Schema.NullOr(Count)),
    answer_durations_ms: Schema.Array(Schema.NullOr(Count)),
    help_used: Schema.Array(Schema.Boolean),
    coaching: Schema.Array(Schema.Unknown),
  }),
);

export const CoachingUpdatedSchema = Schema.Struct({ session_id: Identifier });
