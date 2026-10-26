import { Effect, Option } from 'effect';
import { Atom } from 'effect/reactivity';
import { LEARNING_MEMORY } from '@/core/learning-memory';
import { practiceStateAtom } from '@/core/practice-session';
import type { EvaStage } from '@/shared/ui/eva';
import { isNapping, loadedGrowth, visibleStage } from '../helpers/eva-stage';
import { GrowthSchema } from '../helpers/growth-schema';
import { DEFAULT_GROWTH } from '../preferences';
import { EvaGrowthService } from '../services/eva-growth-service';
import type { EvaGrowthSnapshot } from '../types';
import { growthPreferenceRuntime, runtime } from './runtime';

export const GROWTH_KEY = 'english_trainer_eva_growth';

export const growthPreferenceAtom = Atom.kvs({
  runtime: growthPreferenceRuntime,
  key: GROWTH_KEY,
  schema: GrowthSchema,
  defaultValue: () => DEFAULT_GROWTH,
  mode: 'sync',
});

const finishedSessionAtom = Atom.make((get) => {
  const state = get(practiceStateAtom);
  return state.tag === 'completed' ? state.summary.session_id : null;
});

export const evaGrowthAtom = runtime
  .atom((get) => {
    get(finishedSessionAtom);
    return Effect.gen(function* () {
      const service = yield* EvaGrowthService;
      return yield* service.growth;
    });
  })
  .pipe(Atom.runtime.withReactivity(LEARNING_MEMORY), Atom.keepAlive);

export const knownGrowthAtom = Atom.make(
  (get): EvaGrowthSnapshot | null =>
    loadedGrowth(get(evaGrowthAtom)) ?? Option.getOrNull(get.self<EvaGrowthSnapshot | null>()),
);

export const evaStageAtom = Atom.make((get): EvaStage | null =>
  visibleStage(get(knownGrowthAtom), get(growthPreferenceAtom).showGrowth),
);

export const evaNappingAtom = Atom.make((get): boolean =>
  isNapping(get(knownGrowthAtom), get(growthPreferenceAtom).showGrowth),
);
