import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useContext } from 'react';
import { dismissSummary, practiceStateAtom } from '@/core/practice-session';
import { Debrief } from '@/features/coaching-note';
import {
  CheckingNote,
  type FinishedSession,
  sessionLabel,
  TakeWord,
  useIsTaken,
  useLiveWrapup,
  WrapUpStats,
} from '@/features/wrap-up';
import { Button } from '@/shared/ui/button';
import type { WrapUpScreenProps } from './types';

type ContentProps = {
  readonly initial: FinishedSession;
  readonly onLeave: () => void;
};

function Content({ initial, onLeave }: ContentProps) {
  const registry = useContext(RegistryContext);
  const summary = useLiveWrapup(initial);
  const isTaken = useIsTaken(summary.session_id);
  function leave() {
    dismissSummary(registry);
    onLeave();
  }
  return (
    <div className="mx-auto flex w-full max-w-270 flex-col gap-7 pt-2">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-caption text-faint">{sessionLabel(summary)}</div>
          <h1 className="m-0 text-[30px] font-semibold tracking-tight">
            Nice session. Here’s what to keep.
          </h1>
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={leave} tone="secondary">
            Talk more
          </Button>
          <Button onClick={leave} tone="primary">
            Done
          </Button>
        </div>
      </header>
      <WrapUpStats numbers={summary.numbers} />
      <CheckingNote summary={summary} />
      {summary.turn_count > 0 && (
        <section aria-labelledby="wrapup-debrief" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-body m-0 font-semibold" id="wrapup-debrief">
              Debrief
            </h2>
            <span className="text-caption text-faint">{summary.turn_count}</span>
          </div>
          <Debrief
            isTaken={isTaken}
            renderTake={(word) => <TakeWord sessionId={summary.session_id} word={word} />}
            sessionId={summary.session_id}
          />
        </section>
      )}
    </div>
  );
}

export function WrapUpScreen({ onLeave }: WrapUpScreenProps) {
  const state = useAtomValue(practiceStateAtom);
  if (state.tag !== 'completed') return null;
  return <Content initial={state.summary} onLeave={onLeave} />;
}
