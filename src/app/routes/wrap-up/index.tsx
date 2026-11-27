import { RegistryContext, useAtom } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import { dismissSummary } from '@/core/practice-session';
import { startMistakeRunAtom } from '@/features/mistake-run';
import { WrapUpScreen } from '@/screens/wrap-up';

export function WrapUpRoute() {
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const [starting, start] = useAtom(startMistakeRunAtom);
  return (
    <WrapUpScreen
      isStartingRun={AsyncResult.isWaiting(starting)}
      onLeave={() => void navigate({ to: '/' })}
      onPractiseRule={(ruleKey) =>
        start({
          target: { kind: 'rule', ruleKey },
          onStarted: (runId) => {
            dismissSummary(registry);
            void navigate({ to: '/mistakes/practice/$runId', params: { runId: String(runId) } });
          },
        })
      }
    />
  );
}
