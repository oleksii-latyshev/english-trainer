import { LevelMeter, MicButton } from '@/components/MicControl';
import { Button } from '@/shared/ui/button';
import '@/features/memory/reviewComposer.css';
import { REVIEW_FIX_LABEL, type ReviewIssue } from '@/features/memory/lib/reviewIssue';
import type { ReviewMicCopy } from '@/features/memory/lib/reviewTurn';

/** A problem with the one thing that fixes it. */
export function ReviewIssueNotice({ issue, onFix }: { issue: ReviewIssue; onFix: () => void }) {
  return (
    <div className="review-issue" role="alert">
      <span>{issue.message}</span>
      <Button onClick={onFix} size="sm" tone="secondary">
        {REVIEW_FIX_LABEL[issue.fix]}
      </Button>
    </div>
  );
}

type Props = {
  copy: ReviewMicCopy;
  isLive: boolean;
  level: number;
  issue: ReviewIssue | null;
  /** The button beside the microphone: "Skip" for an item, "Cancel" for a practice try. */
  secondaryLabel: 'Skip' | 'Cancel';
  isSecondaryDisabled: boolean;
  onMic: () => void;
  onSecondary: () => void;
  onFix: () => void;
};

/** The microphone card at the bottom of the review, the same control Talk uses. */
export function ReviewComposer({
  copy,
  isLive,
  level,
  issue,
  secondaryLabel,
  isSecondaryDisabled,
  onMic,
  onSecondary,
  onFix,
}: Props) {
  return (
    <section aria-label="Your answer" className="review-composer" data-live={isLive}>
      {issue && <ReviewIssueNotice issue={issue} onFix={onFix} />}
      <div className="review-composer-main">
        <MicButton
          icon={copy.icon}
          isDisabled={!copy.isPressable}
          name={copy.name}
          onPress={onMic}
          variant={copy.variant}
        />
        <div className="review-mic-copy" role="status">
          <span className="review-mic-title">{copy.title}</span>
          <span className="review-mic-hint">{copy.hint}</span>
        </div>
        <LevelMeter isActive={isLive} level={level} />
        <Button disabled={isSecondaryDisabled} onClick={onSecondary} tone="quiet">
          {secondaryLabel}
        </Button>
      </div>
    </section>
  );
}
