import { Schema } from 'effect';
import type { AverageAnswer } from '../bindings/AverageAnswer';
import type { FinishedPracticeSession } from '../bindings/FinishedPracticeSession';
import type { ProviderError } from '../bindings/ProviderError';
import type { ProviderErrorCode } from '../bindings/ProviderErrorCode';
import type { RecurringMistake } from '../bindings/RecurringMistake';
import type { ReplyStage } from '../bindings/ReplyStage';
import type { SavedWrapupPhrases } from '../bindings/SavedWrapupPhrases';
import type { SessionNumbers } from '../bindings/SessionNumbers';
import type { SpeakingTime } from '../bindings/SpeakingTime';
import type { Trend } from '../bindings/Trend';
import type { WordsPerMinute } from '../bindings/WordsPerMinute';
import type { WrapupPhrase } from '../bindings/WrapupPhrase';
import type { WrapupPreparation } from '../bindings/WrapupPreparation';
import { bindingSchema } from './binding-schema';
import { PhraseCardRecordSchema } from './learning';
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

export const SpeakingTimeSchema = bindingSchema<SpeakingTime>()(
  Schema.Struct({ duration_ms: Schema.NullOr(Count), trend: TrendSchema }),
);

export const WordsPerMinuteSchema = bindingSchema<WordsPerMinute>()(
  Schema.Struct({ value: Schema.NullOr(Count), trend: TrendSchema }),
);

export const AverageAnswerSchema = bindingSchema<AverageAnswer>()(
  Schema.Struct({ words: Schema.NullOr(Count), trend: TrendSchema }),
);

export const SessionNumbersSchema = bindingSchema<SessionNumbers>()(
  Schema.Struct({
    speaking_time: SpeakingTimeSchema,
    words_per_minute: WordsPerMinuteSchema,
    average_answer: AverageAnswerSchema,
  }),
);

export const WrapupPhraseSchema = bindingSchema<WrapupPhrase>()(
  Schema.Struct({
    sequence: Identifier,
    phrase: Schema.String,
    note: Schema.String,
    you_said: Schema.String,
  }),
);

export const RecurringMistakeSchema = bindingSchema<RecurringMistake>()(
  Schema.Struct({
    original: Schema.String,
    improved: Schema.String,
    explanation: Schema.String,
    times: Count,
  }),
);

const ProviderErrorCodeSchema = bindingSchema<ProviderErrorCode>()(
  Schema.Literals([
    'unavailable',
    'unauthorized',
    'rate_limited',
    'timeout',
    'cancelled',
    'invalid_output',
    'process_failed',
    'invalid_request',
    'busy',
    'invalid_session',
    'database_error',
  ]),
);

const ReplyStageSchema = bindingSchema<ReplyStage>()(
  Schema.Literals(['envelope', 'schema', 'content']),
);

export const ProviderErrorSchema = bindingSchema<ProviderError>()(
  Schema.Struct({
    code: ProviderErrorCodeSchema,
    message: Schema.String,
    reply_stage: Schema.optionalKey(ReplyStageSchema),
  }),
);

export const WrapupPreparationSchema = bindingSchema<WrapupPreparation>()(
  Schema.Union([
    Schema.Struct({ state: Schema.Literal('legacy') }),
    Schema.Struct({ state: Schema.Literal('pending') }),
    Schema.Struct({ state: Schema.Literal('ready') }),
    Schema.Struct({ state: Schema.Literal('failed'), error: ProviderErrorSchema }),
  ]),
);

export const FinishedSessionSchema = bindingSchema<FinishedPracticeSession>()(
  Schema.Struct({
    session_id: Identifier,
    finished: Schema.Boolean,
    turn_count: Count,
    target_turns: Identifier,
    duration_ms: Count,
    topic_label: Schema.String,
    duration_goal_seconds: Count,
    numbers: SessionNumbersSchema,
    phrases: Schema.Array(WrapupPhraseSchema),
    recurring_mistakes: Schema.Array(RecurringMistakeSchema),
    pending_coaching: Count,
    is_coaching_paused: Schema.Boolean,
    wrapup_preparation: WrapupPreparationSchema,
    practice_mode: PracticeModeSchema,
    practice_phase: PracticePhaseSchema,
    written_turn_count: Count,
    spoken_turn_count: Count,
    is_mistake_practice: Schema.Boolean,
  }),
);

export const SavedWrapupPhrasesSchema = bindingSchema<SavedWrapupPhrases>()(
  Schema.Struct({
    cards: Schema.Array(PhraseCardRecordSchema),
    created_ids: Schema.Array(Identifier),
  }),
);

export const WRAPUP_UPDATED_EVENT = 'wrapup-updated';

export const WrapupUpdatedSchema = Schema.Struct({ session_id: Identifier });
