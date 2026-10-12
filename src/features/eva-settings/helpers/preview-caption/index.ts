import type { EvaStage } from '@/shared/ui/eva';

export const PREVIEW_STAGES = [
  { value: 1, label: 'Sprout' },
  { value: 3, label: 'Bud' },
  { value: 4, label: 'Bloom' },
  { value: 5, label: 'Full bloom' },
] as const satisfies readonly { value: EvaStage; label: string }[];

export const DEFAULT_PREVIEW_STAGE: EvaStage = 4;

const STAGE_NAMES: Record<EvaStage, string> = {
  0: 'Seed',
  1: 'Sprout',
  2: 'Two leaves',
  3: 'Bud',
  4: 'Bloom',
  5: 'Full bloom',
};

export function stageCaption(stage: EvaStage, showsGrowth: boolean): string {
  return showsGrowth ? STAGE_NAMES[stage] : 'Growth hidden';
}

export function growthHint(showsGrowth: boolean): string {
  return showsGrowth
    ? 'Eva grows a plant as you speak. Turning it off loses nothing.'
    : 'Eva stays a simple companion. Your progress is kept.';
}
