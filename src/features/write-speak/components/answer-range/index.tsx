import {
  feedbackSummary,
  hasSavedAnswers,
  questionForSequence,
  sequencesBetween,
} from '../../helpers/answer-range';
import type { RenderAnswerReview, WriteSpeakDialogue } from '../../types';
import { AnswerCard } from '../answer-card';

type Props = {
  sessionId: number;
  title: string;
  start: number;
  end: number;
  label: (sequence: number) => string;
  dialogue: WriteSpeakDialogue | null;
  writtenEnd: number;
  renderAnswerReview: RenderAnswerReview;
};

export function AnswerRange({
  sessionId,
  title,
  start,
  end,
  label,
  dialogue,
  writtenEnd,
  renderAnswerReview,
}: Props) {
  const sequences = sequencesBetween(start, end);
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-3">
      <h2 className="m-0 text-base font-semibold">
        {title} ({sequences.length})
      </h2>
      <p aria-live="polite" className="text-caption text-muted m-0 leading-snug">
        {feedbackSummary(dialogue, sequences)}
      </p>
      {sequences.map((sequence) => (
        <AnswerCard
          dialogue={dialogue}
          key={sequence}
          label={label(sequence)}
          question={questionForSequence(dialogue, sequence, writtenEnd)}
          renderAnswerReview={renderAnswerReview}
          sequence={sequence}
          sessionId={sessionId}
        />
      ))}
      {dialogue && !hasSavedAnswers(dialogue, sequences) && (
        <p className="text-caption text-muted m-0 leading-snug">
          These answers are not available in the saved dialogue.
        </p>
      )}
    </section>
  );
}
