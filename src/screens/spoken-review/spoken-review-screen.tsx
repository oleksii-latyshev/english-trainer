import {
  ReviewComposer,
  ReviewHeader,
  ReviewNotice,
  ReviewStage,
  ReviewSummary,
  useReviewScreen,
} from '@/features/spoken-review';
import type { SpokenReviewScreenProps } from './types';

export function SpokenReviewScreen({
  onBackToMemory,
  onStartTalk,
  onOpenSettings,
}: SpokenReviewScreenProps) {
  const { view, isWarmup, isSummary, isAnswering } = useReviewScreen();

  if (view.tag !== 'ready') {
    return <ReviewNotice isWarmup={isWarmup} onLeave={onBackToMemory} tag={view.tag} />;
  }
  return (
    <div className="mx-auto flex h-full min-h-0 max-w-6xl flex-col">
      <ReviewHeader onBackToMemory={onBackToMemory} />
      {isSummary ? (
        <div className="mx-auto w-full max-w-180 px-6 pt-8">
          <ReviewSummary onBackToMemory={onBackToMemory} onStartTalk={onStartTalk} />
        </div>
      ) : (
        <>
          <ReviewStage onOpenSettings={onOpenSettings} />
          {isAnswering && <ReviewComposer onOpenSettings={onOpenSettings} />}
        </>
      )}
    </div>
  );
}
