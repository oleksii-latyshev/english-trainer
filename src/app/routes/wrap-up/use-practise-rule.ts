import { RegistryContext, useAtom } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import type { RuleKey } from '@/core/mistakes';
import { dismissSummary } from '@/core/practice-session';
import { startMistakeRunAtom } from '@/features/mistake-run';

export function usePractiseRule() {
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const [starting, start] = useAtom(startMistakeRunAtom);
  return {
    isStartingRun: AsyncResult.isWaiting(starting),
    onPractiseRule: (ruleKey: RuleKey) =>
      start({
        target: { kind: 'rule', ruleKey },
        onStarted: (runId) => {
          dismissSummary(registry);
          void navigate({ to: '/mistakes/practice/$runId', params: { runId: String(runId) } });
        },
      }),
  };
}
