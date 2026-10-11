import type { EvaStage } from './types';

export const BODY_WIDTH = 114;
export const BODY_HEIGHT = 90;
export const CENTER_X = BODY_WIDTH / 2;
export const PLANT_BASE_Y = 3;
export const EYE_Y = 39.6;
export const EYE_SPREAD = 17.1;
export const MOUTH_Y = 57.6;

export const VIEW_LEFT = -4;
export const VIEW_WIDTH = BODY_WIDTH + 8;
export const VIEW_BOTTOM = 112;

const NO_PLANT_TOP = -4;

const PLANT_TOP: Record<EvaStage, number> = {
  0: -4,
  1: -20,
  2: -26,
  3: -32,
  4: -42,
  5: -56,
};

export function viewTop(stage: EvaStage | null): number {
  return stage === null ? NO_PLANT_TOP : PLANT_TOP[stage];
}

export const BODY_PATH =
  'M0 52.2A57 52.2 0 0 1 57 0A57 52.2 0 0 1 114 52.2A52.44 37.8 0 0 1 61.56 90H52.44A52.44 37.8 0 0 1 0 52.2Z';
