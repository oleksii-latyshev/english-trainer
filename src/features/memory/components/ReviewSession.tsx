import { useEffect, useRef } from 'react';
import { isRunFinished, summarizeReview } from '@/features/memory/lib/memoryRecallState';
import { useReviewFlow } from '@/features/memory/useReviewFlow';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { LearningStatus } from '@/lib/learningTypes';
import type { MemoryReviewRun } from '@/lib/memoryRecallTypes';
import { warmSpeechEngine } from '@/lib/speechTypes';
import { ReviewActive } from './ReviewActive';
import { ReviewHeader } from './ReviewHeader';
import { ReviewSummary } from './ReviewSummary';

type Props = {
  initialRun: MemoryReviewRun;
  /** Each item's status before this review, by `type:id`; empty when it could not be read. */
  statusBefore: ReadonlyMap<string, LearningStatus>;
  speech: ReturnType<typeof useSystemSpeech>;
  onBackToMemory: () => void;
  onStartTalk: () => void;
  onOpenSettings: () => void;
  warmup?: boolean;
};

export function ReviewSession({
  initialRun,
  statusBefore,
  speech,
  onBackToMemory,
  onStartTalk,
  onOpenSettings,
  warmup = false,
}: Props) {
  const flow = useReviewFlow({ initialRun, speech, onBackToMemory, onOpenSettings });
  const warmupFinished = useRef(false);
  const warmedRunId = useRef<number | null>(null);
  useEffect(() => {
    if (isRunFinished(initialRun.items) || warmedRunId.current === initialRun.run_id) return;
    warmedRunId.current = initialRun.run_id;
    // Optional prewarming never blocks review; final transcription reports failures and can
    // use one-off recognition when the server cannot start, as it does in Talk.
    void warmSpeechEngine().catch(() => {});
  }, [initialRun]);
  useEffect(() => {
    if (!warmup || flow.step.tag !== 'summary' || warmupFinished.current) return;
    warmupFinished.current = true;
    onStartTalk();
  }, [flow.step.tag, onStartTalk, warmup]);

  if (flow.step.tag !== 'summary') {
    return (
      <ReviewActive
        canReplay={speech.state.tag !== 'unavailable'}
        flow={flow}
        statusBefore={statusBefore}
        warmup={warmup}
      />
    );
  }
  return (
    <>
      <ReviewHeader
        isBusy={false}
        items={flow.run.items}
        onEnd={onBackToMemory}
        position={null}
        endLabel={warmup ? 'Start conversation' : undefined}
      />
      <div className="review-body">
        <ReviewSummary
          onBackToMemory={onBackToMemory}
          onStartTalk={onStartTalk}
          summary={summarizeReview(flow.run.items)}
        />
      </div>
    </>
  );
}
