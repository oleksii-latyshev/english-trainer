import { createLocalPreference, isRecord } from '@/lib/localPreference';

export const FIRST_RUN_PATH = '/welcome';

/** The three setup steps in order; the ids double as the stepper's keys. */
export const FIRST_RUN_STEPS = [
  { id: 'microphone', label: 'Microphone' },
  { id: 'ai', label: 'Conversation AI' },
  { id: 'voice', label: 'Voice' },
] as const;

export type FirstRunStepId = (typeof FIRST_RUN_STEPS)[number]['id'];

export type StepIndicator = {
  id: FirstRunStepId;
  label: string;
  /** What the badge shows: the step number, or a check once the step is behind the learner. */
  badge: string;
  status: 'done' | 'current' | 'upcoming';
};

export function stepIndicators(current: FirstRunStepId): StepIndicator[] {
  const currentIndex = FIRST_RUN_STEPS.findIndex((step) => step.id === current);
  return FIRST_RUN_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    badge: index < currentIndex ? '✓' : String(index + 1),
    status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
  }));
}

/** The step after `current`, or undefined on the last one (where "Start talking" takes over). */
export function nextStep(current: FirstRunStepId): FirstRunStepId | undefined {
  const index = FIRST_RUN_STEPS.findIndex((step) => step.id === current);
  return FIRST_RUN_STEPS[index + 1]?.id;
}

export function previousStep(current: FirstRunStepId): FirstRunStepId | undefined {
  const index = FIRST_RUN_STEPS.findIndex((step) => step.id === current);
  return index > 0 ? FIRST_RUN_STEPS[index - 1]?.id : undefined;
}

/**
 * Whether first run has been dealt with. `pending` is the only state that can show it on launch;
 * `existing` records that the app found signs of earlier use, so it never asks later either.
 */
export type FirstRunStatus = 'pending' | 'finished' | 'skipped' | 'existing';

export type FirstRunMarker = { status: FirstRunStatus };

export const FIRST_RUN_KEY = 'english_trainer_first_run';

function isFirstRunStatus(value: unknown): value is FirstRunStatus {
  return value === 'pending' || value === 'finished' || value === 'skipped' || value === 'existing';
}

export function parseFirstRunMarker(value: unknown): FirstRunMarker {
  if (!isRecord(value) || !isFirstRunStatus(value.status)) return { status: 'pending' };
  return { status: value.status };
}

export const firstRunMarker = createLocalPreference<FirstRunMarker>(
  FIRST_RUN_KEY,
  parseFirstRunMarker,
);

/** Signs that the learner already uses the app; any one of them means first run is not for them. */
export type UseEvidence = {
  hasSession: boolean;
  hasGeminiKey: boolean;
  hasMemory: boolean;
  hasVoiceChoice: boolean;
  hasMicrophoneChoice: boolean;
};

export type FirstRunDecision = 'show' | 'existing-user' | 'already-handled';

/**
 * Launch rule: show first run only while the marker is still pending and nothing says the learner
 * has used the app before. Finish and Skip move the marker, so it is never shown twice.
 */
export function decideFirstRun(status: FirstRunStatus, evidence: UseEvidence): FirstRunDecision {
  if (status !== 'pending') return 'already-handled';
  return Object.values(evidence).some(Boolean) ? 'existing-user' : 'show';
}
