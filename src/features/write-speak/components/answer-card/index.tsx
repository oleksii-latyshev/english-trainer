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
    <article className="border-line bg-surface flex min-w-0 flex-col gap-2 rounded-2xl border p-3.5">
      <div className="text-caption text-faint font-semibold">{label}</div>
      {question && <p className="text-caption text-muted m-0 leading-snug">{question}</p>}
      <p className="leading-copy m-0 wrap-anywhere">{turn.learner}</p>
      {coaching ? (
        renderAnswerReview({ sessionId, sequence, transcript: turn.learner, coaching })
      ) : (
        <p className="text-caption text-muted m-0 leading-snug">
          {coachingStatusMessage(coaching)}
        </p>
      )}
    </article>
  );
}
