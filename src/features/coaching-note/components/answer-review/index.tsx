import { RegistryContext, useAtom } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Volume2 } from 'lucide-react';
import { type ReactNode, useContext } from 'react';
import { createPlayback } from '@/core/speech';
import { Button } from '@/shared/ui/button';
import { answerKey } from '../../helpers/answer-key';
import { reviewView } from '../../helpers/review-view';
import { highlightRewrite } from '../../helpers/rewrite-diff';
import { retryCoachingAtom } from '../../model/atoms';
import type { AnswerTarget, ReviewedAnswer, TurnCoaching, TurnFeedback } from '../../types';
import { SayAgain } from '../say-again';

type Props = {
  target: AnswerTarget;
  transcript: string;
  coaching: TurnCoaching | undefined;
  renderActions?: (answer: ReviewedAnswer) => ReactNode;
};

const PAUSED_MESSAGE =
  'Coaching is paused for now because Antigravity has no quota left. Talking is not affected.';

function Rewrite({ feedback, transcript }: { feedback: TurnFeedback; transcript: string }) {
  return (
    <p className="text-body text-foreground leading-copy m-0" data-word-lookup>
      {highlightRewrite(transcript, feedback.b2_rewrite).map((part, index) =>
        part.isChanged ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: The runs are positional output of one rewrite.
          <mark className="bg-ok-bg text-ok rounded-sm px-0.5" key={index}>
            {part.text}
          </mark>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: The runs are positional output of one rewrite.
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

function Why({ feedback }: { feedback: TurnFeedback }) {
  const focus = feedback.focus_feedback[0];
  if (!focus) {
    return <p className="text-caption text-muted m-0">No priority correction was found.</p>;
  }
  return (
    <div className="text-caption text-muted flex flex-col gap-1">
      <p className="m-0" data-word-lookup>
        {focus.explanation}
      </p>
      <p className="m-0" data-word-lookup>
        You said “{focus.original}” · try “{focus.improved}”
      </p>
    </div>
  );
}

function RetryLine(props: { target: AnswerTarget; message: string; actionLabel: string }) {
  const { target, message, actionLabel } = props;
  const [result, retry] = useAtom(retryCoachingAtom(answerKey(target)));
  const hasFailed = AsyncResult.isFailure(result) && !AsyncResult.isWaiting(result);
  return (
    <div className="text-caption text-muted flex flex-wrap items-center gap-2">
      <span>{message}</span>
      <Button
        disabled={AsyncResult.isWaiting(result)}
        onClick={() => retry(target)}
        size="sm"
        tone="quiet"
      >
        {actionLabel}
      </Button>
      {hasFailed && <span role="alert">Could not ask again. Please retry.</span>}
    </div>
  );
}

function ReadyReview({
  target,
  transcript,
  feedback,
  renderActions,
}: Omit<Props, 'coaching'> & { feedback: TurnFeedback }) {
  const registry = useContext(RegistryContext);
  return (
    <>
      <span className="text-caption text-faint">More natural</span>
      <Rewrite feedback={feedback} transcript={transcript} />
      <Why feedback={feedback} />
      <SayAgain
        target={target}
        trailing={
          <>
            <Button
              onClick={() => void createPlayback(registry).play(feedback.b2_rewrite)}
              size="sm"
              tone="quiet"
            >
              <Volume2 aria-hidden="true" />
              Hear it
            </Button>
            {renderActions?.({ target, feedback })}
          </>
        }
      />
    </>
  );
}

export function AnswerReview({ target, transcript, coaching, renderActions }: Props) {
  const view = reviewView(coaching);
  return (
    <section
      aria-label={`Review of answer ${target.sequence}`}
      className="border-line bg-surface flex flex-col gap-2.5 rounded-2xl border px-4.5 py-3.5"
    >
      {view.tag === 'pending' && (
        <p className="text-caption text-muted m-0" role="status">
          Checking your answer…
        </p>
      )}
      {view.tag === 'paused' && (
        <RetryLine actionLabel="Try again" message={PAUSED_MESSAGE} target={target} />
      )}
      {view.tag === 'failed' && (
        <RetryLine actionLabel="Retry" message="Couldn’t check this answer." target={target} />
      )}
      {view.tag === 'ready' && (
        <ReadyReview
          feedback={view.feedback}
          renderActions={renderActions}
          target={target}
          transcript={transcript}
        />
      )}
    </section>
  );
}
