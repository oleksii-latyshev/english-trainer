import { Schema } from 'effect';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Identifier = Schema.Int.check(Schema.isGreaterThan(0));

export const PracticeModeSchema = Schema.Literals(['voice', 'text_chat', 'write_then_speak']);

export const PracticePhaseSchema = Schema.Literals([
  'writing',
  'writing_review',
  'speaking',
  'speaking_review',
]);

export const AttemptComparisonSchema = Schema.Struct({
  turn_sequence: Identifier,
  original_transcript: Schema.String,
  retry_transcript: Schema.String,
  target: Schema.String,
  target_evidence: Schema.Literals([
    'already_present_in_both',
    'newly_observed_in_retry',
    'partially_observed',
    'not_observed',
    'uncertain',
  ]),
  word_count_change: Schema.Int,
  hesitation: Schema.String,
});

export const PracticeSessionSchema = Schema.Struct({
  session_id: Identifier,
  opening_question: Schema.String,
  turn_count: Count,
  target_turns: Identifier,
  retry_evidence: Schema.Array(AttemptComparisonSchema),
  topic_id: Schema.String,
  topic_label: Schema.String,
  topic_custom: Schema.NullOr(Schema.String),
  duration_goal_seconds: Schema.Literals([300, 600, 900]),
  active_duration_ms: Count,
  started_at: Count,
  is_clock_running: Schema.Boolean,
  is_mistake_practice: Schema.optionalKey(Schema.Boolean),
  practice_mode: Schema.optionalKey(PracticeModeSchema),
  practice_phase: Schema.optionalKey(PracticePhaseSchema),
  written_turn_count: Schema.optionalKey(Count),
  spoken_turn_count: Schema.optionalKey(Count),
});

export const FinishedSessionSchema = Schema.Record(Schema.String, Schema.Unknown);

export const PracticeDialogueSchema = Schema.Struct({
  session_id: Identifier,
  opening_question: Schema.String,
  turns: Schema.Array(
    Schema.Struct({
      learner: Schema.String,
      assistant_reply: Schema.String,
      assistant_question: Schema.String,
      answered_by: Schema.optionalKey(
        Schema.NullOr(
          Schema.Struct({
            provider: Schema.Literals(['gemini', 'apple', 'agy']),
            model: Schema.String,
            is_backup: Schema.Boolean,
          }),
        ),
      ),
    }),
  ),
  input_sources: Schema.optionalKey(Schema.Array(Schema.Literals(['voice', 'edited', 'text']))),
  reply_times_ms: Schema.optionalKey(Schema.Array(Schema.NullOr(Count))),
  answer_durations_ms: Schema.optionalKey(Schema.Array(Schema.NullOr(Count))),
  help_used: Schema.optionalKey(Schema.Array(Schema.Boolean)),
  coaching: Schema.optionalKey(Schema.Array(Schema.Unknown)),
});

export const CoachingUpdatedSchema = Schema.Struct({ session_id: Identifier });
