export const STEP_LABELS = ['Fill the gaps', 'Fix it', 'Say it', 'Use it'] as const;

export function stepLabel(step: number): string {
  return STEP_LABELS[Math.min(Math.max(step, 1), STEP_LABELS.length) - 1];
}
