import type { RuleKey } from '@/core/mistakes';

export type WrapUpScreenProps = {
  readonly sessionId?: number;
  readonly isStartingRun: boolean;
  readonly onLeave: () => void;
  readonly onPractiseRule: (ruleKey: RuleKey) => void;
};
