export const FIRST_RUN_STEPS = [
  { id: 'microphone', label: 'Microphone' },
  { id: 'ai', label: 'Conversation AI' },
  { id: 'voice', label: 'Voice' },
] as const;

export type FirstRunStepId = (typeof FIRST_RUN_STEPS)[number]['id'];

export type StepProgress = {
  readonly id: FirstRunStepId;
  readonly label: string;
  readonly status: 'done' | 'current' | 'upcoming';
};

function indexOfStep(step: FirstRunStepId): number {
  return FIRST_RUN_STEPS.findIndex((candidate) => candidate.id === step);
}

function statusOf(index: number, currentIndex: number): StepProgress['status'] {
  if (index < currentIndex) return 'done';
  return index === currentIndex ? 'current' : 'upcoming';
}

export function stepProgress(current: FirstRunStepId): StepProgress[] {
  const currentIndex = indexOfStep(current);
  return FIRST_RUN_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: statusOf(index, currentIndex),
  }));
}

export function stepNumber(step: FirstRunStepId): number {
  return indexOfStep(step) + 1;
}

export function nextStep(current: FirstRunStepId): FirstRunStepId | undefined {
  return FIRST_RUN_STEPS[indexOfStep(current) + 1]?.id;
}

export function previousStep(current: FirstRunStepId): FirstRunStepId | undefined {
  const index = indexOfStep(current);
  return index > 0 ? FIRST_RUN_STEPS[index - 1]?.id : undefined;
}
