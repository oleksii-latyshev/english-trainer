import { Button } from '@heroui/react';
import type { MemoryReviewItem } from '@/lib/memoryRecallTypes';

type Props = {
  items: MemoryReviewItem[];
  /** 1-based position of the item on screen; absent once the review is done. */
  position: number | null;
  isBusy: boolean;
  onEnd: () => void;
  endLabel?: string;
};

function pipState(index: number, position: number | null): 'done' | 'current' | 'ahead' {
  if (position === null || index < position - 1) return 'done';
  return index === position - 1 ? 'current' : 'ahead';
}

/** Where the learner is in the review, and the way out. */
export function ReviewHeader({ items, position, isBusy, onEnd, endLabel }: Props) {
  return (
    <header className="review-header">
      <div className="review-title">
        <span className="review-kicker">Memory</span>
        <h1>Spoken review</h1>
      </div>
      <div className="review-progress">
        <div aria-hidden="true" className="review-pips">
          {items.map((item, index) => (
            <i data-state={pipState(index, position)} key={item.position} />
          ))}
        </div>
        <span className="review-count">
          {position === null ? 'Done' : `${position} of ${items.length}`}
        </span>
      </div>
      <Button className="review-end" isDisabled={isBusy} onPress={onEnd} size="sm" variant="ghost">
        {endLabel ?? (position === null ? 'Back to Memory' : 'End review')}
      </Button>
    </header>
  );
}
