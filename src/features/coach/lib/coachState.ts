import type { SentAnswer } from '@/features/practice/lib/sentAnswer';
import type { TurnFeedback } from '@/lib/types';

export type CoachStep = 1 | 2 | 3 | 4 | 5;

export type StepInputs = {
  hasSession: boolean;
  hasTranscript: boolean;
  savedAnswer: SentAnswer | null;
  retryAnchor: (SentAnswer & { feedback: TurnFeedback }) | null;
  isRetrying: boolean;
  hasComparison: boolean;
};

export function deriveCoachStep(inputs: StepInputs): CoachStep {
  if (!inputs.hasSession) return 1;
  if (inputs.hasComparison && inputs.isRetrying) return 5;
  if (inputs.isRetrying || inputs.retryAnchor !== null) return 4;
  if (inputs.savedAnswer !== null) return 3;
  if (inputs.hasTranscript) return 2;
  return 1;
}
