import { coachingStatusMessage } from '../../helpers/answer-range';
import type { RenderAnswerReview, WriteSpeakDialogue } from '../../types';

type Props = {
  sessionId: number;
  sequence: number;
  label: string;
  question: string;
  dialogue: WriteSpeakDialogue | null;
  renderAnswerReview: RenderAnswerReview;
};

export function AnswerCard({
  sessionId,
  sequence,
  label,
  question,
  dialogue,
  renderAnswerReview,
}: Props) {
  const index = sequence - 1;
  const turn = dialogue?.turns[index];
  if (!turn?.learner.trim()) return null;
  const coaching = dialogue?.coaching?.[index];
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5">
      <div className="font-semibold text-caption text-faint">{label}</div>
      {question && <p className="m-0 text-caption text-muted leading-snug">{question}</p>}
      <p className="wrap-anywhere m-0 leading-copy">{turn.learner}</p>
      {coaching ? (
        renderAnswerReview({ sessionId, sequence, transcript: turn.learner, coaching })
      ) : (
        <p className="m-0 text-caption text-muted leading-snug">
          {coachingStatusMessage(coaching)}
        </p>
      )}
    </article>
  );
}
