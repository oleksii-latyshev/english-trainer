import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { useContext } from 'react';
import { dismissSummary, practiceStateAtom, replaceSummary } from '@/core/practice-session';
import { PracticeCompletion } from '@/features/practice/PracticeCompletion';
import { isFinishedPracticeSession } from '@/lib/finishedPracticeSession';

export function SummaryRoute() {
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const state = useAtomValue(practiceStateAtom);
  if (state.tag !== 'completed' || !isFinishedPracticeSession(state.summary)) return null;

  function leave() {
    dismissSummary(registry);
    void navigate({ to: '/' });
  }

  return (
    <PracticeCompletion
      onDone={leave}
      onSummaryUpdated={(summary) => replaceSummary(registry, summary)}
      onTalkMore={leave}
      summary={state.summary}
    />
  );
}
