import { Button, Card } from '@heroui/react';
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
    <Card className="panel border border-white/10 bg-slate-900/60 p-4" variant="secondary">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-teal-500/10 px-2 py-0.5 text-xs font-semibold text-teal-300">
            {mistake.category.toUpperCase()}
          </span>
          <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
            {formatStatusLabel(mistake.status)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>
            Observed {mistake.times_seen} {mistake.times_seen === 1 ? 'time' : 'times'}
          </span>
          <span>·</span>
          <span className={mistake.is_due ? 'font-medium text-amber-300' : 'text-slate-400'}>
            {dueText}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        <p className="m-0 text-sm text-slate-300">
          <span className="text-slate-400">You said:</span> {mistake.original_example}
        </p>
        <p className="m-0 text-base font-semibold text-teal-100">
          <span className="text-sm font-normal text-slate-400">Correction:</span>{' '}
          {mistake.corrected_example}
        </p>
        <p className="m-0 text-xs text-slate-400">{mistake.explanation}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
        <span
          className="text-xs text-slate-400"
          title="Self-reported recall updates schedule without claiming spoken mastery."
        >
          Review recall:
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
        <p className="error-message mt-2 text-xs" role="alert">
          {reviewError}
        </p>
      )}
    </Card>
  );
}
