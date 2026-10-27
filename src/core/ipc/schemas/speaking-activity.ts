import { Schema } from 'effect';
import type { SpeakingActivity } from '../bindings/SpeakingActivity';
import type { SpeakingDay } from '../bindings/SpeakingDay';
import { bindingSchema } from './binding-schema';

const SpeakingDaySchema = bindingSchema<SpeakingDay>()(
  Schema.Struct({
    date: Schema.String,
    minutes: Schema.Int.check(Schema.isGreaterThan(0)),
  }),
);

export const SpeakingActivitySchema = bindingSchema<SpeakingActivity>()(
  Schema.Struct({ days: Schema.Array(SpeakingDaySchema) }),
);
