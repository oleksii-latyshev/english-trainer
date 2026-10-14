import { useAtomRefresh } from '@effect/atom-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import { openedReviewAtom } from '../../model/session-atoms';

type Props = {
  tag: 'loading' | 'nothing' | 'error';
  isWarmup: boolean;
  onLeave: () => void;
};

function Notice({ title, hint, actions }: { title: string; hint: string; actions: ReactNode }) {
  return (
    <section className="mx-auto mt-24 flex max-w-130 flex-col gap-3.5 rounded-card border border-line bg-surface p-7 shadow-overlay backdrop-blur-glass backdrop-saturate-170">
      <h1 className="m-0 font-bold text-2xl tracking-tight">{title}</h1>
      <p className="m-0 text-muted">{hint}</p>
      <div className="flex gap-2">{actions}</div>
    </section>
  );
}

export function ReviewNotice({ tag, isWarmup, onLeave }: Props) {
  const retry = useAtomRefresh(openedReviewAtom);
  const leaveLabel = isWarmup ? 'Skip and start conversation' : 'Back to Memory';

  if (tag === 'loading') {
    return (
      <p className="mt-24 text-center text-muted" role="status">
        Getting your review ready…
      </p>
    );
  }
  if (tag === 'nothing') {
    return (
      <Notice
        actions={
          <Button onClick={onLeave} tone="primary">
            {leaveLabel}
          </Button>
        }
        hint={
          isWarmup
            ? 'No phrases are ready for warmup. You can start your conversation now.'
            : 'Nothing due has a cue that is safe to practise out loud yet. Your saved items are unchanged.'
        }
        title="Nothing to review right now"
      />
    );
  }
  return (
    <Notice
      actions={
        <>
          <Button onClick={retry} tone="primary">
            Try again
          </Button>
          <Button onClick={onLeave} tone="secondary">
            {leaveLabel}
          </Button>
        </>
      }
      hint="Your saved items are unchanged. Try again in a moment."
      title="Could not start the review"
    />
  );
}
