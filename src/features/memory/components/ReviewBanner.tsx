import { Button } from '@heroui/react';
import { Check, Mic } from 'lucide-react';
import { type ActiveReview, reviewBannerCopy } from '@/features/memory/lib/reviewBanner';

type Props = {
  dueCount: number;
  active: ActiveReview;
  /** Another recording or answer is using the microphone. */
  isBusy: boolean;
  onStart: () => void;
};

/** The spoken-review card at the top of Memory. */
export function ReviewBanner({ dueCount, active, isBusy, onStart }: Props) {
  const copy = reviewBannerCopy(dueCount, active);
  return (
    <section aria-label="Spoken review" className="memory-review" data-state={copy.state}>
      <span aria-hidden="true" className="memory-review-icon">
        {copy.state === 'calm' ? <Check size={22} strokeWidth={2.4} /> : <Mic size={22} />}
      </span>
      <div className="memory-review-copy">
        <div className="memory-review-title">{copy.title}</div>
        <div className="memory-review-hint">{copy.hint}</div>
      </div>
      {copy.actionLabel && (
        <Button
          className="memory-review-action"
          isDisabled={isBusy}
          onPress={onStart}
          variant="primary"
        >
          {copy.actionLabel}
        </Button>
      )}
    </section>
  );
}
