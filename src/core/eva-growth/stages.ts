import type { EvaStage } from '@/shared/ui/eva';

export type StageInfo = { stage: EvaStage; name: string; need: string };

export const STAGES = [
  { stage: 0, name: 'Seed', need: 'First talk' },
  { stage: 1, name: 'Sprout', need: '10 drops' },
  { stage: 2, name: 'Two leaves', need: '30 drops' },
  { stage: 3, name: 'Bud', need: '60 drops' },
  { stage: 4, name: 'Bloom', need: '100 drops' },
  { stage: 5, name: 'Full bloom', need: '150 drops' },
] as const satisfies readonly StageInfo[];

export function stageInfo(stage: EvaStage): StageInfo {
  return STAGES[stage];
}
