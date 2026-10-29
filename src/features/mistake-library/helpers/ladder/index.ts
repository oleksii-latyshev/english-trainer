import { STEP_LABELS } from '@/core/mistakes';

type LadderState = 'done' | 'current' | 'todo';

export type LadderStep = {
  readonly number: number;
  readonly label: string;
  readonly state: LadderState;
};

export const STEP_COUNT = STEP_LABELS.length;

export function ladderSteps(ladderStep: number, isFixed: boolean): readonly LadderStep[] {
  return STEP_LABELS.map((label, index) => {
    const number = index + 1;
    if (isFixed || number < ladderStep) return { number, label, state: 'done' };
    return { number, label, state: number === ladderStep ? 'current' : 'todo' };
  });
}

export function reachedSteps(ladderStep: number, isFixed: boolean): number {
  return isFixed ? STEP_COUNT : Math.min(Math.max(ladderStep, 1), STEP_COUNT);
}
