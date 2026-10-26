import { Schema } from 'effect';
import type { EvaGrowth } from '../bindings/EvaGrowth';
import type { SpeakingGain } from '../bindings/SpeakingGain';
import type { SunshineGain } from '../bindings/SunshineGain';
import type { TodayGains } from '../bindings/TodayGains';
import { bindingSchema } from './binding-schema';

const Drops = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

const SpeakingGainSchema = bindingSchema<SpeakingGain>()(
  Schema.Struct({ drops: Drops, topic: Schema.String }),
);

const SunshineGainSchema = bindingSchema<SunshineGain>()(
  Schema.Struct({ drops: Drops, phrase: Schema.String }),
);

const TodayGainsSchema = bindingSchema<TodayGains>()(
  Schema.Struct({
    speaking: Schema.Array(SpeakingGainSchema),
    sunshine: Schema.Array(SunshineGainSchema),
  }),
);

export const EvaGrowthSchema = bindingSchema<EvaGrowth>()(
  Schema.Struct({
    drops: Drops,
    stage: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 5 })),
    stage_floor: Drops,
    next_threshold: Schema.NullOr(Drops),
    napping: Schema.Boolean,
    today: TodayGainsSchema,
  }),
);
