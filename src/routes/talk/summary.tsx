import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { useContext } from 'react';
import { dismissSummary, practiceStateAtom } from '@/core/practice-session';
import { WrapUpScreen } from '@/screens/wrap-up';

export function SummaryRoute() {
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const state = useAtomValue(practiceStateAtom);
  if (state.tag !== 'completed') return null;

  function leave() {
    dismissSummary(registry);
    void navigate({ to: '/' });
  }

  return <WrapUpScreen onDone={leave} onTalkMore={leave} summary={state.summary} />;
}
