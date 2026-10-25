import { RegistryContext, useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import { canChangeSessionAtom } from '@/core/answer-capture';
import { isSessionBusyAtom, practiceStateAtom } from '@/core/practice-session';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import {
  recallActiveAtom,
  recallPlanAtom,
  recallRecorderAtom,
  recallResultAtom,
  submitRecallAtom,
} from '../../model/atoms';
import { leaveRecall, nextRecall, startRecall } from '../../model/controls';
import type { DailyRecallPlan, SpokenRecallResult } from '../../types';
import { RecallRecorder } from '../recall-recorder';

type Props = {
  sessionId: number;
  isStartBlocked: boolean;
};

const TEXT = 'm-0 text-caption text-muted leading-normal';
const CAPTION = 'm-0 text-faint text-xs';
const SAVE_FAILED =
  'Could not confirm spoken recall. Keep your transcript and retry; saved attempts will not duplicate.';

function ResultCard(props: { result: SpokenRecallResult; hasNext: boolean }) {
  const registry = useContext(RegistryContext);
  const { result } = props;
  return (
    <div className="flex flex-col gap-2.5" role="status">
      <p className={TEXT}>You said: {result.transcript}</p>
      <p className={TEXT}>Saved phrase: {result.target}</p>
      <p className={TEXT}>
        {result.wording_observed
          ? 'The saved wording appears in your transcript.'
          : 'The full saved wording was not found in your transcript.'}{' '}
        This text check is not a pronunciation or mastery score.
      </p>
      <div className="flex flex-wrap gap-2">
        {props.hasNext ? (
          <Button onClick={() => nextRecall(registry)} size="sm" tone="secondary">
            Next phrase
          </Button>
        ) : (
          <Button onClick={() => leaveRecall(registry)} size="sm" tone="secondary">
            Return to conversation
          </Button>
        )}
      </div>
    </div>
  );
}

function ActiveRecall(props: { sessionId: number; phraseId: number; cue: string }) {
  const registry = useContext(RegistryContext);
  const recorder = useAtomValue(recallRecorderAtom);
  const canLeaveSession = useAtomValue(canChangeSessionAtom);
  const [submitResult, submit] = useAtom(submitRecallAtom(props.sessionId));
  const isSaving = AsyncResult.isWaiting(submitResult);
  const hasFailed = AsyncResult.isFailure(submitResult) && !isSaving;
  return (
    <div className="flex flex-col gap-2.5">
      <p className={TEXT}>
        Cue: <strong>{props.cue}</strong>
      </p>
      <p className={CAPTION}>
        Record your phrase with the microphone above, transcribe it locally, then save this attempt.
      </p>
      {hasFailed && (
        <Notice className="rounded-control border" role="alert" tone="warn">
          {SAVE_FAILED}
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        {recorder.transcript && (
          <Button
            disabled={isSaving}
            onClick={() => submit({ phraseId: props.phraseId, transcript: recorder.transcript })}
            size="sm"
            tone="primary"
          >
            {isSaving ? 'Saving recall…' : 'Save spoken recall'}
          </Button>
        )}
        <Button
          disabled={isSaving || !canLeaveSession}
          onClick={() => leaveRecall(registry)}
          size="sm"
          tone="quiet"
        >
          Leave recall
        </Button>
      </div>
    </div>
  );
}

function PlanStatus(props: { plan: DailyRecallPlan; hasResult: boolean }) {
  const { plan } = props;
  return (
    <>
      <p className={TEXT}>
        {plan.completed_count} spoken recall {plan.completed_count === 1 ? 'attempt' : 'attempts'}{' '}
        saved this session.
      </p>
      {plan.items.length === 0 && !props.hasResult && (
        <p className={TEXT}>No more due phrases with a usable cue. You can finish practice.</p>
      )}
    </>
  );
}

function Plan(props: { sessionId: number; isStartBlocked: boolean }) {
  const registry = useContext(RegistryContext);
  const plan = useAtomValue(recallPlanAtom(props.sessionId));
  const reload = useAtomRefresh(recallPlanAtom(props.sessionId));
  const isActive = useAtomValue(recallActiveAtom);
  const result = useAtomValue(recallResultAtom);
  const isSessionBusy = useAtomValue(isSessionBusyAtom);
  const canChangeSession = useAtomValue(canChangeSessionAtom);
  const practice = useAtomValue(practiceStateAtom);
  const canStart =
    canChangeSession && !isSessionBusy && !props.isStartBlocked && practice.tag === 'active';

  if (AsyncResult.isFailure(plan)) {
    return (
      <Notice className="flex items-center gap-3 rounded-control border" role="alert" tone="warn">
        <span>Could not load due phrases. Retry to continue.</span>
        <Button onClick={reload} size="sm" tone="secondary">
          Retry loading
        </Button>
      </Notice>
    );
  }
  const loaded = AsyncResult.isSuccess(plan) ? plan.value : undefined;
  if (loaded === undefined) {
    return (
      <p className={TEXT} role="status">
        Loading due phrases…
      </p>
    );
  }
  const current = loaded.items[0];
  return (
    <>
      <PlanStatus hasResult={result !== null} plan={loaded} />
      {current && !isActive && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canStart}
            onClick={() => startRecall(registry)}
            size="sm"
            tone="secondary"
          >
            Start spoken recall
          </Button>
        </div>
      )}
      {isActive && current && !result && (
        <ActiveRecall cue={current.cue} phraseId={current.phrase_id} sessionId={props.sessionId} />
      )}
      {result && <ResultCard hasNext={current !== undefined} result={result} />}
    </>
  );
}

export function SpokenRecall({ sessionId, isStartBlocked }: Props) {
  const isActive = useAtomValue(recallActiveAtom);
  const result = useAtomValue(recallResultAtom);
  const plan = useAtomValue(recallPlanAtom(sessionId));
  const isSaving = AsyncResult.isWaiting(useAtomValue(submitRecallAtom(sessionId)));
  const cue = AsyncResult.isSuccess(plan) ? plan.value.items[0]?.cue : undefined;
  return (
    <>
      {isActive && (
        <RecallRecorder
          cue={cue ?? 'Review your saved recall below.'}
          isLocked={isSaving || result !== null}
        />
      )}
      <section
        aria-label="Spoken phrase recall"
        className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5"
      >
        <div className="font-semibold text-accent text-xs tracking-wide">Spoken phrase recall</div>
        <p className={TEXT}>
          Review a phrase from an earlier session. Recall is optional. Its result is saved as
          transcript evidence; it does not grant mastery automatically.
        </p>
        <Plan isStartBlocked={isStartBlocked} sessionId={sessionId} />
      </section>
    </>
  );
}
