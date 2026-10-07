import { summarizeReview } from '@/features/memory/lib/memoryRecallState';
import { useReviewFlow } from '@/features/memory/useReviewFlow';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { LearningStatus } from '@/lib/learningTypes';
import type { MemoryReviewRun } from '@/lib/memoryRecallTypes';
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
};

export function ReviewSession({
  initialRun,
  statusBefore,
  speech,
  onBackToMemory,
  onStartTalk,
  onOpenSettings,
}: Props) {
  const flow = useReviewFlow({ initialRun, speech, onBackToMemory, onOpenSettings });

  if (flow.step.tag !== 'summary') {
    return (
      <ReviewActive
        canReplay={speech.state.tag !== 'unavailable'}
        flow={flow}
        statusBefore={statusBefore}
      />
    );
  }
  return (
    <>
      <ReviewHeader isBusy={false} items={flow.run.items} onEnd={onBackToMemory} position={null} />
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
