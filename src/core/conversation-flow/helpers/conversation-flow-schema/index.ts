import { Schema, SchemaGetter } from 'effect';
import { withFallback } from '@/shared/schema/with-fallback';
import {
  AUTO_SEND_DELAY_RANGE_MS,
  type ConversationFlow,
  DEFAULT_CONVERSATION_FLOW,
  END_PAUSE_RANGE_MS,
} from '../../conversation-flow';

type Range = { readonly min: number; readonly max: number };

function clampedMs(range: Range, fallback: number) {
  const clamped = Schema.Finite.pipe(
    Schema.decodeTo(Schema.Number, {
      decode: SchemaGetter.transform((ms: number) =>
        Math.min(range.max, Math.max(range.min, Math.round(ms))),
      ),
      encode: SchemaGetter.passthrough(),
    }),
  );
  return withFallback(clamped, fallback);
}

const defaults = DEFAULT_CONVERSATION_FLOW;

const ConversationFlowFields = Schema.Struct({
  autoListen: withFallback(Schema.Boolean, defaults.autoListen),
  handsFree: withFallback(Schema.Boolean, defaults.handsFree),
  endPauseMs: clampedMs(END_PAUSE_RANGE_MS, defaults.endPauseMs),
  autoSendVoice: withFallback(Schema.Boolean, defaults.autoSendVoice),
  autoSendDelayMs: clampedMs(AUTO_SEND_DELAY_RANGE_MS, defaults.autoSendDelayMs),
  voiceInterrupt: withFallback(Schema.Boolean, defaults.voiceInterrupt),
});

function asFields(value: unknown): (typeof ConversationFlowFields)['Encoded'] {
  const isRecord = typeof value === 'object' && value !== null && !Array.isArray(value);
  return isRecord ? value : {};
}

export const ConversationFlowSchema = Schema.Unknown.pipe(
  Schema.decodeTo(ConversationFlowFields, {
    decode: SchemaGetter.transform(asFields),
    encode: SchemaGetter.passthrough(),
  }),
);

export const decodeConversationFlow: (value: unknown) => ConversationFlow =
  Schema.decodeUnknownSync(ConversationFlowSchema);
