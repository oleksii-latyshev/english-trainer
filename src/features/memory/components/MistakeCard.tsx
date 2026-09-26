import { Button, Card, Chip } from '@heroui/react';
import { useState } from 'react';
import type { MistakeRecord, ReviewResponse } from '@/lib/learningTypes';
import { formatDueText, formatStatusLabel } from '../lib/memoryState';

type Props = {
  mistake: MistakeRecord;
  onReview: (id: number, response: ReviewResponse) => Promise<void>;
};

export function MistakeCard({ mistake, onReview }: Props) {
  const [isPending, setIsPending] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleReview(response: ReviewResponse) {
    if (isPending) return;
    setIsPending(true);
    setReviewError(null);
    try {
      await onReview(mistake.id, response);
    } catch {
      setReviewError('Could not record review. Please retry.');
    } finally {
      setIsPending(false);
    }
  }

  const dueText = formatDueText(mistake.next_review_at);

  return (
    <Card
      className="panel border border-white/[0.08] bg-[#161619] p-4 shadow-sm"
      variant="secondary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
        <div className="flex items-center gap-2">
          <Chip color="danger" size="sm" variant="soft">
            {mistake.category.toUpperCase()}
          </Chip>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
            {formatStatusLabel(mistake.status)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>
            Seen {mistake.times_seen} {mistake.times_seen === 1 ? 'time' : 'times'}
          </span>
          <span>·</span>
          <span className={mistake.is_due ? 'font-medium text-amber-400' : 'text-zinc-500'}>
            {dueText}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 text-xs">
        <p className="m-0 text-zinc-400">
          <span className="font-semibold text-zinc-500">Original spoken:</span> "
          {mistake.original_example}"
        </p>
        <p className="m-0 text-sm font-semibold text-emerald-300">
          <span className="text-xs font-normal text-zinc-400">Better phrasing:</span> "
          {mistake.corrected_example}"
        </p>
        <p className="m-0 text-[11px] text-zinc-400">{mistake.explanation}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <span
          className="text-xs text-zinc-400"
          title="Self-reported recall updates schedule without claiming spoken mastery."
        >
          Spaced review recall:
        </span>
        <div className="flex items-center gap-2">
          <Button
            className="secondary-action text-xs"
            isDisabled={isPending}
            onPress={() => void handleReview('need_practice')}
            variant="secondary"
          >
            Need practice
          </Button>
          <Button
            className="primary-action text-xs"
            isDisabled={isPending}
            onPress={() => void handleReview('remembered')}
            variant="primary"
          >
            Remembered
          </Button>
        </div>
      </div>

      {reviewError && (
        <p className="error-message mt-2 text-xs text-rose-300" role="alert">
          {reviewError}
        </p>
      )}
    </Card>
  );
}
