import { isRunFinished } from '@/features/memory/lib/memoryRecallState';
import { describeResult } from '@/features/memory/lib/reviewResult';
import { resultEvaMood, reviewEvaMood, reviewMicCopy } from '@/features/memory/lib/reviewTurn';
import type { useReviewFlow } from '@/features/memory/useReviewFlow';
import type { LearningStatus } from '@/lib/learningTypes';
import { ReviewComposer, ReviewIssueNotice } from './ReviewComposer';
import { ReviewHeader } from './ReviewHeader';
import { ReviewContext, ReviewResult, ReviewSituation } from './ReviewStage';

type Flow = ReturnType<typeof useReviewFlow>;

type Props = {
  flow: Flow;
  statusBefore: ReadonlyMap<string, LearningStatus>;
  canReplay: boolean;
};

/** The situation, and below it the answer with its result. */
function ReviewStageContent({ flow, statusBefore, canReplay }: Props) {
  const { step, shownItem, prompt, issue } = flow;
  const before = shownItem
    ? (statusBefore.get(`${shownItem.item_type}:${shownItem.item_id}`) ?? null)
    : null;
  const result = step.tag === 'result' ? step.result : null;
  // While trying again the saved result is out of the way and the stage shows the situation alone.
  const view =
    step.tag === 'result' && step.attempt.tag !== 'recording'
      ? describeResult(step.result, step.attempt, before)
      : null;
  const mood = view
    ? resultEvaMood(view.tone === 'used')
    : reviewEvaMood(flow.phase, flow.isEvaSpeaking);

  return (
    <div className="review-body">
      <div className="review-stage">
        {shownItem && (
          <ReviewContext
            itemType={shownItem.item_type}
            status={result?.status ?? before}
            target={result?.target ?? null}
          />
        )}
        {prompt && (
          <ReviewSituation
            canReplay={canReplay}
            mood={mood}
            onReplay={flow.replay}
            prompt={prompt}
          />
        )}
        {result && view && (
          <ReviewResult
            isBusy={flow.isBusy}
            itemType={result.item_type}
            nextLabel={isRunFinished(flow.run.items) ? 'Finish' : 'Next'}
            onNext={flow.next}
            onTryAgain={flow.tryAgain}
            target={result.target}
            view={view}
          />
        )}
        {!flow.isAnswering && issue && (
          <ReviewIssueNotice issue={issue} onFix={() => flow.fix(issue.fix)} />
        )}
      </div>
    </div>
  );
}

function ReviewMic({ flow }: { flow: Flow }) {
  const { issue } = flow;
  return (
    <div className="review-composer-zone">
      <ReviewComposer
        copy={reviewMicCopy(flow.phase, flow.isEvaSpeaking, flow.isTryingAgain)}
        isLive={flow.phase === 'listening'}
        isSecondaryDisabled={
          flow.isBusy || flow.phase === 'transcribing' || flow.phase === 'starting'
        }
        issue={issue}
        level={flow.level}
        onFix={() => issue && flow.fix(issue.fix)}
        onMic={flow.pressMic}
        onSecondary={flow.pressSecondary}
        secondaryLabel={flow.isTryingAgain ? 'Cancel' : 'Skip'}
      />
    </div>
  );
}

/** One item of the review. */
export function ReviewActive({ flow, statusBefore, canReplay }: Props) {
  return (
    <>
      <ReviewHeader
        isBusy={flow.isEnding}
        items={flow.run.items}
        onEnd={flow.end}
        position={flow.shownItem?.position ?? null}
      />
      <ReviewStageContent canReplay={canReplay} flow={flow} statusBefore={statusBefore} />
      {flow.isAnswering && <ReviewMic flow={flow} />}
    </>
  );
}
