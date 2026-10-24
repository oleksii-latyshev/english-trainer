import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { useContext } from 'react';
import { dismissSummary, practiceStateAtom, replaceSummary } from '@/core/practice-session';
import { ConversationReview } from '@/features/coaching-note';
import { PracticeCompletion } from '@/features/practice/PracticeCompletion';
import { isFinishedPracticeSession } from '@/lib/finishedPracticeSession';

export function SummaryRoute() {
  const registry = useContext(RegistryContext);
  const navigate = useNavigate();
  const state = useAtomValue(practiceStateAtom);
  if (state.tag !== 'completed' || !isFinishedPracticeSession(state.summary)) return null;
  const { session_id: sessionId, turn_count: turnCount } = state.summary;

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
    >
      {turnCount > 0 && (
        <section aria-labelledby="wrapup-conversation" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="m-0 font-semibold text-body" id="wrapup-conversation">
              Your conversation
            </h2>
            <span className="text-caption text-faint">{turnCount}</span>
          </div>
          <ConversationReview sessionId={sessionId} />
        </section>
      )}
    </PracticeCompletion>
  );
}
