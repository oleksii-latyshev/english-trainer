import { FIRST_RUN_STEPS, type FirstRunStepId, stepNumber } from '@/core/first-run';

type StepCopy = { readonly title: string; readonly lead: string };

const COPY: Record<FirstRunStepId, StepCopy> = {
  microphone: {
    title: 'First, let’s hear you',
    lead: 'English Trainer is a speaking app. Speech is turned into text on this Mac; audio is not kept.',
  },
  ai: {
    title: 'Who will Eva be?',
    lead: 'Eva needs an AI model to reply. You can change this later in Settings.',
  },
  voice: {
    title: 'Pick Eva’s voice',
    lead: 'Choose one you’d enjoy listening to every day.',
  },
};

export function stepCopy(step: FirstRunStepId): StepCopy {
  return COPY[step];
}

export function stepLabel(step: FirstRunStepId): string {
  return `Step ${stepNumber(step)} of ${FIRST_RUN_STEPS.length}`;
}
