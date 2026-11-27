import { Schema } from 'effect';
import type { AverageAnswer } from '../bindings/AverageAnswer';
import type { FinishedPracticeSession } from '../bindings/FinishedPracticeSession';
import type { RecurringMistake } from '../bindings/RecurringMistake';
import type { SessionNumbers } from '../bindings/SessionNumbers';
import type { SpeakingTime } from '../bindings/SpeakingTime';
import type { Trend } from '../bindings/Trend';
import type { WordsPerMinute } from '../bindings/WordsPerMinute';
import { bindingSchema } from './binding-schema';
import { PracticeModeSchema, PracticePhaseSchema } from './practice-session';

const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Identifier = Schema.Int.check(Schema.isGreaterThan(0));

export const TrendSchema = bindingSchema<Trend>()(
  Schema.Union([
    Schema.Struct({ kind: Schema.Literal('first') }),
    Schema.Struct({ kind: Schema.Literal('same') }),
    Schema.Struct({ kind: Schema.Literal('percent'), change: Schema.Int }),
    Schema.Struct({ kind: Schema.Literal('words'), change: Schema.Int }),
  ]),
);

const SpeakingTimeSchema = bindingSchema<SpeakingTime>()(
  Schema.Struct({ duration_ms: Schema.NullOr(Count), trend: TrendSchema }),
);

const WordsPerMinuteSchema = bindingSchema<WordsPerMinute>()(
  Schema.Struct({ value: Schema.NullOr(Count), trend: TrendSchema }),
);

const AverageAnswerSchema = bindingSchema<AverageAnswer>()(
  Schema.Struct({ words: Schema.NullOr(Count), trend: TrendSchema }),
);

export const SessionNumbersSchema = bindingSchema<SessionNumbers>()(
  Schema.Struct({
    speaking_time: SpeakingTimeSchema,
    words_per_minute: WordsPerMinuteSchema,
    average_answer: AverageAnswerSchema,
  }),
);

const RecurringMistakeSchema = bindingSchema<RecurringMistake>()(
  Schema.Struct({
    original: Schema.String,
    improved: Schema.String,
    explanation: Schema.String,
    times: Count,
  }),
);

export const FinishedSessionSchema = bindingSchema<FinishedPracticeSession>()(
  Schema.Struct({
    session_id: Identifier,
    finished: Schema.Boolean,
    turn_count: Count,
    target_turns: Identifier,
    duration_ms: Count,
    topic_label: Schema.String,
    duration_goal_seconds: Schema.NullOr(Count),
    numbers: SessionNumbersSchema,
    recurring_mistakes: Schema.Array(RecurringMistakeSchema),
    pending_coaching: Count,
    is_coaching_paused: Schema.Boolean,
    practice_mode: PracticeModeSchema,
    practice_phase: PracticePhaseSchema,
    written_turn_count: Count,
    spoken_turn_count: Count,
    is_mistake_practice: Schema.Boolean,
  }),
);
