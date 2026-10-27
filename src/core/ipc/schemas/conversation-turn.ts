import { Schema } from 'effect';
import type { AnsweredBy } from '../bindings/AnsweredBy';
import type { AnswerProvider } from '../bindings/AnswerProvider';
import type { ConversationTurn } from '../bindings/ConversationTurn';
import type { ReplyStreamEvent } from '../bindings/ReplyStreamEvent';
import { bindingSchema } from './binding-schema';

const AnswerProviderSchema = bindingSchema<AnswerProvider>()(
  Schema.Literals(['gemini', 'apple', 'agy']),
);

export const AnsweredBySchema = bindingSchema<AnsweredBy>()(
  Schema.Struct({
    provider: AnswerProviderSchema,
    model: Schema.String,
    is_backup: Schema.Boolean,
  }),
);

const Milliseconds = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const ConversationTurnSchema = bindingSchema<ConversationTurn>()(
  Schema.Struct({
    spoken_reply: Schema.String,
    question: Schema.NullOr(Schema.String),
    session_phase: Schema.String,
    is_complete: Schema.Boolean,
    provider_latency_ms: Schema.optionalKey(Milliseconds),
    first_token_ms: Schema.optionalKey(Milliseconds),
    answered_by: Schema.optionalKey(AnsweredBySchema),
  }),
);

export const ReplyStreamEventSchema = bindingSchema<ReplyStreamEvent>()(
  Schema.Struct({
    kind: Schema.Literal('delta'),
    text: Schema.String,
  }),
);
