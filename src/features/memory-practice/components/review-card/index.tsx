import { useAtomValue } from '@effect/atom-react';
import { Button } from '@/shared/ui/button';
import { Eva } from '@/shared/ui/eva';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { reviewCopy } from '../../helpers/review-copy';
import { activeReviewAtom, practiceTargetsAtom } from '../../model/atoms';

type Props = {
  isAudioBusy: boolean;
  onStart: () => void;
};

export function ReviewCard({ isAudioBusy, onStart }: Props) {
  const targets = useAtomValue(practiceTargetsAtom);
  const active = useAtomValue(activeReviewAtom);
  const dueCount = targets.tag === 'ready' ? targets.dueCount : 0;
  const copy = reviewCopy(dueCount, active);

  return (
    <GlassPanel
      aria-label="Spoken review"
      className="flex items-center gap-4.5 border-accent-line bg-accent-soft px-4.5 py-4 shadow-sky"
    >
      <Eva decorative mood={copy.state === 'calm' ? 'idle' : 'happy'} size={62} />
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-lg tracking-tight">{copy.title}</h2>
        <p className="mt-1 mb-0 text-muted leading-copy">{copy.hint}</p>
      </div>
      {copy.actionLabel && (
        <Button
          disabled={isAudioBusy || targets.tag === 'loading'}
          onClick={onStart}
          size="sm"
          tone="primary"
        >
          {copy.actionLabel}
        </Button>
      )}
    </GlassPanel>
  );
}
