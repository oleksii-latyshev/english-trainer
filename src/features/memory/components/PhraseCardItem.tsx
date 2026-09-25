import { Button, Card } from '@heroui/react';
import { useState } from 'react';
import type { PhraseCardRecord, ReviewResponse } from '@/lib/learningTypes';
import { formatDueText, formatStatusLabel } from '../lib/memoryState';

type Props = {
  phraseCard: PhraseCardRecord;
  onReview: (id: number, response: ReviewResponse) => Promise<void>;
};

export function PhraseCardItem({ phraseCard, onReview }: Props) {
  const [isPending, setIsPending] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleReview(response: ReviewResponse) {
    if (isPending) return;
    setIsPending(true);
    setReviewError(null);
    try {
      await onReview(phraseCard.id, response);
    } catch {
      setReviewError('Could not record review. Please retry.');
    } finally {
      setIsPending(false);
    }
  }

  const dueText = formatDueText(phraseCard.next_review_at);

  return (
    <Card className="panel border border-white/10 bg-slate-900/60 p-4" variant="secondary">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-300">
            PHRASE
          </span>
          <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">
            {formatStatusLabel(phraseCard.status)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>
            Interval: {phraseCard.interval_days} {phraseCard.interval_days === 1 ? 'day' : 'days'}
          </span>
          <span>·</span>
          <span className={phraseCard.is_due ? 'font-medium text-amber-300' : 'text-slate-400'}>
            {dueText}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        <blockquote className="m-0 border-l-2 border-teal-400/70 pl-3 text-base font-semibold leading-relaxed text-slate-100">
          {phraseCard.phrase}
        </blockquote>
        {phraseCard.meaning_or_note && (
          <p className="mt-1 mb-0 text-xs text-slate-400">{phraseCard.meaning_or_note}</p>
        )}
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
