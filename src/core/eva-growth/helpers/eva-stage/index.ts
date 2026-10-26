import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { EvaStage } from '@/shared/ui/eva';
import { STAGES } from '../../stages';
import type { EvaGrowthFailure, EvaGrowthSnapshot } from '../../types';

export type GrowthResult = AsyncResult.AsyncResult<EvaGrowthSnapshot, EvaGrowthFailure>;

export function toEvaStage(stage: number): EvaStage {
  return (STAGES[stage] ?? STAGES[STAGES.length - 1]).stage;
}

export function loadedGrowth(result: GrowthResult): EvaGrowthSnapshot | null {
  return Option.getOrNull(AsyncResult.value(result));
}

export function visibleStage(
  growth: EvaGrowthSnapshot | null,
  showGrowth: boolean,
): EvaStage | null {
  return showGrowth && growth !== null ? toEvaStage(growth.stage) : null;
}

export function isNapping(growth: EvaGrowthSnapshot | null, showGrowth: boolean): boolean {
  return showGrowth && (growth?.napping ?? false);
}
