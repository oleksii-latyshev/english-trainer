import { RegistryContext, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
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
  wrapupAtom,
} from '@/features/wrap-up';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import type { WrapUpScreenProps } from './types';

type ContentProps = WrapUpScreenProps & {
  readonly initial: FinishedSession;
  readonly isReopened: boolean;
};

function Actions({ isReopened, onLeave }: Pick<ContentProps, 'isReopened' | 'onLeave'>) {
  if (isReopened) {
    return (
      <Button onClick={onLeave} tone="secondary">
        Back
      </Button>
    );
  }
  return (
    <>
      <Button onClick={onLeave} tone="secondary">
        Talk more
      </Button>
      <Button onClick={onLeave} tone="primary">
        Done
      </Button>
    </>
  );
}

function Content({ initial, isReopened, isStartingRun, onLeave, onPractiseRule }: ContentProps) {
  const registry = useContext(RegistryContext);
  const summary = useLiveWrapup(initial);
  const isTaken = useIsTaken(summary.session_id);
  function leave() {
    if (!isReopened) dismissSummary(registry);
    onLeave();
  }
  return (
    <div className="mx-auto flex w-full max-w-270 flex-col gap-7 pt-2">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-caption text-faint">{sessionLabel(summary)}</div>
          <h1 className="m-0 text-[30px] font-semibold tracking-tight">
            {isReopened ? 'Your conversation' : 'Nice session. Here’s what to keep.'}
          </h1>
        </div>
        <div className="ml-auto flex gap-2">
          <Actions isReopened={isReopened} onLeave={leave} />
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
            isStartingRun={isStartingRun}
            isTaken={isTaken}
            onPractiseRule={onPractiseRule}
            renderTake={(word) => <TakeWord sessionId={summary.session_id} word={word} />}
            sessionId={summary.session_id}
          />
        </section>
      )}
    </div>
  );
}

function Reopened({ sessionId, ...props }: WrapUpScreenProps & { readonly sessionId: number }) {
  const result = useAtomValue(wrapupAtom(sessionId));
  const refresh = useAtomRefresh(wrapupAtom(sessionId));
  if (AsyncResult.isSuccess(result))
    return <Content {...props} initial={result.value} isReopened />;
  if (AsyncResult.isFailure(result)) {
    return (
      <Notice
        className="rounded-control mx-auto flex w-full max-w-270 items-center justify-between gap-3 border"
        role="alert"
        tone="warn"
      >
        <span>Could not open this conversation.</span>
        <span className="flex gap-2">
          <Button onClick={refresh} size="sm" tone="secondary">
            Retry
          </Button>
          <Button onClick={props.onLeave} size="sm" tone="secondary">
            Back
          </Button>
        </span>
      </Notice>
    );
  }
  return (
    <p className="text-caption text-muted m-0 text-center" role="status">
      Opening your conversation…
    </p>
  );
}

export function WrapUpScreen({ sessionId, ...props }: WrapUpScreenProps) {
  const state = useAtomValue(practiceStateAtom);
  if (sessionId !== undefined) return <Reopened {...props} sessionId={sessionId} />;
  if (state.tag !== 'completed') return null;
  return <Content {...props} initial={state.summary} isReopened={false} />;
}
