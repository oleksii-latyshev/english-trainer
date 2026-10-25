import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { Notice } from '@/shared/ui/notice';
import { findingOutcome } from '../../helpers/finding-outcome';
import { reviewUsageAtom, savedUsageAtom, usageKey, usageReviewViewAtom } from '../../model/atoms';
import type { TurnUsageAssessment, UsageFinding, UsageReviewView, UsageTarget } from '../../types';

type Props = {
  target: UsageTarget;
};

const CAPTION = 'm-0 text-caption text-faint leading-copy';

function Finding({ finding }: { finding: UsageFinding }) {
  const outcome = findingOutcome(finding);
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-background px-3 py-2 text-caption text-muted leading-normal">
      <div className="flex items-center gap-2">
        <strong>Target: “{finding.target}”</strong>
        <span className="ml-auto">
          <Chip tone={outcome.tone}>{outcome.label}</Chip>
        </span>
      </div>
      {finding.exact_excerpt && (
        <p className="m-0">Saved transcript excerpt: “{finding.exact_excerpt}”</p>
      )}
      <p className="m-0 text-faint text-xs">Saved item status: {finding.status_after}</p>
    </div>
  );
}

function Assessment({ assessment }: { assessment: TurnUsageAssessment }) {
  if (assessment.findings.length === 0) {
    return (
      <p className={CAPTION}>
        No eligible earlier learning targets were available for this answer. No progress was
        recorded.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {assessment.findings.map((finding) => (
        <Finding finding={finding} key={`${finding.item_type}-${finding.item_id}`} />
      ))}
    </div>
  );
}

function Body({ view, onRetry }: { view: UsageReviewView; onRetry: () => void }) {
  switch (view.tag) {
    case 'restoring':
      return <p className={CAPTION}>Restoring saved learning review…</p>;
    case 'checking':
      return (
        <p className={CAPTION} role="status">
          Checking saved answer with AI…
        </p>
      );
    case 'restore-error':
    case 'review-error':
      return (
        <Notice className="flex items-center gap-3 rounded-control border" role="alert" tone="warn">
          <span>{view.message}</span>
          <Button onClick={onRetry} size="sm" tone="secondary">
            Retry
          </Button>
        </Notice>
      );
    case 'success':
      return <Assessment assessment={view.assessment} />;
    case 'idle':
      return null;
  }
}

export function UsageReviewCard({ target: answer }: Props) {
  const target = usageKey(answer);
  const view = useAtomValue(usageReviewViewAtom(target));
  const check = useAtomSet(reviewUsageAtom(target));
  const restore = useAtomRefresh(savedUsageAtom(target));
  const canCheck = view.tag === 'idle' || view.tag === 'review-error';

  return (
    <section
      aria-label="Learning use review"
      className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5"
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-accent text-xs tracking-wide">Learning use review</span>
        <Chip>Answer {answer.sequence}</Chip>
        {canCheck && (
          <Button className="ml-auto" onClick={() => check(undefined)} size="sm" tone="secondary">
            Check learning use
          </Button>
        )}
      </div>
      <p className={CAPTION}>
        This sends your saved answer transcript and eligible learning targets to your configured AI
        provider. You can keep speaking while it reviews.
      </p>
      <Body onRetry={view.tag === 'review-error' ? () => check(undefined) : restore} view={view} />
    </section>
  );
}
