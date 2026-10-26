import type { SessionDetails } from '@/core/practice-session';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { modeLabel, reviewCopy } from '../../helpers/review-copy';
import { useReviewControls } from '../../model/use-review-controls';
import type { RenderAnswerReview, WriteSpeakDialogue } from '../../types';
import { AnswerRange } from '../answer-range';

type Props = {
  session: SessionDetails;
  dialogue: WriteSpeakDialogue | null;
  historyError: string;
  isLocked: boolean;
  onRetryHistory: () => void;
  renderAnswerReview: RenderAnswerReview;
};

const NOTE_CLASS = 'm-0 text-caption text-muted leading-snug';

export function WriteSpeakReview({
  session,
  dialogue,
  historyError,
  isLocked,
  onRetryHistory,
  renderAnswerReview,
}: Props) {
  const copy = reviewCopy(session.practicePhase);
  const controls = useReviewControls(isLocked);
  const isWritingReview = session.practicePhase === 'writing_review';
  const hasWritten = session.writtenTurnCount > 0;
  const writtenEnd = session.writtenTurnCount;
  const spokenEnd = writtenEnd + session.spokenTurnCount;
  const canMoveToSpeaking = isWritingReview && session.practiceMode === 'write_then_speak';

  return (
    <section
      aria-label={copy.title}
      className="mx-auto flex min-h-0 w-full max-w-262 flex-1 flex-col gap-5 overflow-auto p-6"
    >
      <header className="flex items-start justify-between gap-5 border-line-soft border-b pb-4">
        <div>
          <p className="m-0 font-semibold text-caption text-faint uppercase tracking-wider">
            {session.topicLabel} · {modeLabel(session.practiceMode)}
          </p>
          <h1 className="mt-0.5 mb-1.5 font-semibold text-2xl">{copy.title}</h1>
          <p className="m-0 max-w-175 text-muted leading-copy">{copy.detail}</p>
        </div>
        <Button disabled={controls.isDisabled} onClick={controls.finish} tone="secondary">
          Finish
        </Button>
      </header>

      {controls.error && (
        <Notice role="alert" tone="warn">
          {controls.error}
        </Notice>
      )}
      {historyError && (
        <Notice role="alert" tone="warn">
          <span>{historyError}</span>
          <Button onClick={onRetryHistory} size="sm" tone="secondary">
            Retry history
          </Button>
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
        {hasWritten && (
          <AnswerRange
            dialogue={dialogue}
            end={writtenEnd}
            label={(sequence) => `Written answer ${sequence}`}
            renderAnswerReview={renderAnswerReview}
            sessionId={session.sessionId}
            start={1}
            title="Written answers"
            writtenEnd={writtenEnd}
          />
        )}
        {!isWritingReview && session.spokenTurnCount > 0 && (
          <AnswerRange
            dialogue={dialogue}
            end={spokenEnd}
            label={(sequence) => `Spoken answer ${sequence - writtenEnd}`}
            renderAnswerReview={renderAnswerReview}
            sessionId={session.sessionId}
            start={writtenEnd + 1}
            title="Spoken answers"
            writtenEnd={writtenEnd}
          />
        )}
      </div>

      {canMoveToSpeaking && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
          <Button disabled={controls.isDisabled} onClick={controls.readyToSpeak} tone="primary">
            Ready to speak
          </Button>
          <p className="m-0 text-caption text-muted">
            Eva will ask the same questions in order. The microphone opens when you continue.
          </p>
        </div>
      )}
      {dialogue === null && !historyError && <p className={NOTE_CLASS}>Loading saved answers…</p>}
      {!hasWritten && <p className={NOTE_CLASS}>No written answers were saved.</p>}
    </section>
  );
}
