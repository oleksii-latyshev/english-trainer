import { Button } from '@heroui/react';
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
  warmup?: boolean;
};

function MaterialNotice({ flow, isAnswering }: { flow: Flow; isAnswering: boolean }) {
  const failure =
    (flow.preparation?.state === 'failed' ? flow.preparation.error.message : null) ??
    flow.materialError;
  if (failure) {
    return (
      <div className="review-material-error" role="status">
        <span>{failure}</span>
        <Button
          isDisabled={flow.materialBusy}
          onPress={flow.retryMaterials}
          size="sm"
          variant="secondary"
        >
          Retry situations
        </Button>
      </div>
    );
  }
  if (isAnswering && (flow.materialBusy || flow.preparation?.state === 'pending')) {
    return (
      <p className="review-material-status" role="status">
        Preparing review situations…
      </p>
    );
  }
  return null;
}

function PhraseHint({ flow, item }: { flow: Flow; item: Flow['shownItem'] }) {
  if ((flow.step.tag !== 'answering' && flow.step.tag !== 'result') || item?.item_type !== 'phrase')
    return null;
  if (flow.material?.hint) {
    return (
      <div className="review-hint">
        <span>Practice with a hint — not independent use.</span>
        <p>{flow.material.hint}</p>
      </div>
    );
  }
  if (flow.step.tag !== 'answering') return null;
  return (
    <Button isDisabled={flow.isBusy} onPress={flow.revealPhrase} variant="secondary">
      Show phrase
    </Button>
  );
}

function SavedReviewResult({
  flow,
  result,
  view,
}: {
  flow: Flow;
  result: NonNullable<Extract<Flow['step'], { tag: 'result' }>['result']>;
  view: ReturnType<typeof describeResult>;
}) {
  const answer = flow.material?.model_answer ?? result.target;
  const modelLabel = flow.material?.model_answer
    ? result.item_type === 'mistake'
      ? 'Said better'
      : 'With the phrase'
    : result.item_type === 'mistake'
      ? 'Saved correction'
      : 'Saved phrase';
  return (
    <ReviewResult
      isBusy={flow.isBusy}
      nextLabel={isRunFinished(flow.run.items) ? 'Finish' : 'Next'}
      onNext={flow.next}
      onTryAgain={flow.tryAgain}
      onPlayExample={() => flow.playExample(answer)}
      modelAnswer={answer}
      modelLabel={modelLabel}
      target={result.target}
      view={view}
    />
  );
}

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
            canReplay={canReplay && flow.phase === 'prompt' && !flow.isBusy}
            mood={mood}
            onReplay={flow.replay}
            prompt={prompt}
          />
        )}
        <MaterialNotice flow={flow} isAnswering={flow.step.tag === 'answering'} />
        <PhraseHint flow={flow} item={shownItem} />
        {result && view && <SavedReviewResult flow={flow} result={result} view={view} />}
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
export function ReviewActive({ flow, statusBefore, canReplay, warmup = false }: Props) {
  return (
    <>
      <ReviewHeader
        isBusy={flow.isEnding}
        items={flow.run.items}
        onEnd={flow.end}
        position={flow.shownItem?.position ?? null}
        endLabel={warmup ? 'Skip and start conversation' : undefined}
      />
      <ReviewStageContent canReplay={canReplay} flow={flow} statusBefore={statusBefore} />
      {flow.isAnswering && <ReviewMic flow={flow} />}
    </>
  );
}
