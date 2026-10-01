import { Button, Card, Chip } from '@heroui/react';
import { useState } from 'react';
import type { PhraseCardRecord, ReviewResponse } from '@/lib/learningTypes';
import { formatDueText, formatStatusLabel } from '../lib/memoryState';
import { UsageEvidenceSection } from './UsageEvidenceSection';

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
    <Card
      className="panel border border-white/[0.08] bg-[#161619] p-4 shadow-sm"
      variant="secondary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
        <div className="flex items-center gap-2">
          <Chip color="accent" size="sm" variant="soft">
            PHRASE
          </Chip>
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
            {formatStatusLabel(phraseCard.status)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>
            Interval: {phraseCard.interval_days} {phraseCard.interval_days === 1 ? 'day' : 'days'}
          </span>
          <span>·</span>
          <span className={phraseCard.is_due ? 'font-medium text-amber-400' : 'text-zinc-500'}>
            {dueText}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        <blockquote className="m-0 border-l-2 border-purple-500/70 pl-3 text-sm font-semibold leading-relaxed text-zinc-100">
          "{phraseCard.phrase}"
        </blockquote>
        {phraseCard.meaning_or_note && (
          <p className="mt-1 mb-0 text-xs text-zinc-400">{phraseCard.meaning_or_note}</p>
        )}
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

      <UsageEvidenceSection itemType="phrase" itemId={phraseCard.id} />
    </Card>
  );
}
