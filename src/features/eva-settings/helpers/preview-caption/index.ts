import { stageInfo } from '@/core/eva-growth';
import type { EvaStage } from '@/shared/ui/eva';

export const PREVIEW_STAGES = [
  { value: 1, label: 'Sprout' },
  { value: 3, label: 'Bud' },
  { value: 4, label: 'Bloom' },
  { value: 5, label: 'Full bloom' },
] as const satisfies readonly { value: EvaStage; label: string }[];

export const DEFAULT_PREVIEW_STAGE: EvaStage = 4;

export function stageCaption(stage: EvaStage, showsGrowth: boolean): string {
  return showsGrowth ? stageInfo(stage).name : 'Growth hidden';
}

export function growthHint(showsGrowth: boolean): string {
  return showsGrowth
    ? 'Eva grows a plant as you speak. Turning it off loses nothing.'
    : 'Eva stays a simple companion. Your progress is kept.';
}
