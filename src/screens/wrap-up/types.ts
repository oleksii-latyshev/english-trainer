import type { RuleKey } from '@/core/mistakes';

export type WrapUpScreenProps = {
  readonly isStartingRun: boolean;
  readonly onLeave: () => void;
  readonly onPractiseRule: (ruleKey: RuleKey) => void;
};
