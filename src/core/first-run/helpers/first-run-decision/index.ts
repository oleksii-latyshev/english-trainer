import type { FirstRunStatus } from '../../first-run';

export type UseEvidence = {
  readonly hasSession: boolean;
  readonly hasGeminiKey: boolean;
  readonly hasMemory: boolean;
  readonly hasVoiceChoice: boolean;
  readonly hasMicrophoneChoice: boolean;
};

export type FirstRunDecision = 'show' | 'existing-user' | 'already-handled';

export function decideFirstRun(status: FirstRunStatus, evidence: UseEvidence): FirstRunDecision {
  if (status !== 'pending') return 'already-handled';
  return Object.values(evidence).some(Boolean) ? 'existing-user' : 'show';
}
