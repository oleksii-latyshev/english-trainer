import { originalQuestionLabel } from '../../helpers/review-copy';

type Props = {
  isComplete: boolean;
  question: string;
  spokenTurnCount: number;
  writtenTurnCount: number;
};

export function OriginalQuestion({
  isComplete,
  question,
  spokenTurnCount,
  writtenTurnCount,
}: Props) {
  return (
    <section
      aria-label="Current original question"
      className="mx-10 mt-4.5 flex-none rounded-2xl border border-accent-line bg-accent-soft px-4.5 py-3.5"
    >
      <span className="font-semibold text-caption text-faint">
        {originalQuestionLabel(isComplete, spokenTurnCount, writtenTurnCount)}
      </span>
      <p className="m-0 mt-1 font-semibold text-foreground text-lg leading-snug">
        {isComplete ? 'All original questions are answered.' : question}
      </p>
    </section>
  );
}
