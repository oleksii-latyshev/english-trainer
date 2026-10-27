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
      className="border-accent-line bg-accent-soft mx-10 mt-4.5 flex-none rounded-2xl border px-4.5 py-3.5"
    >
      <span className="text-caption text-faint font-semibold">
        {originalQuestionLabel(isComplete, spokenTurnCount, writtenTurnCount)}
      </span>
      <p className="text-foreground m-0 mt-1 text-lg leading-snug font-semibold">
        {isComplete ? 'All original questions are answered.' : question}
      </p>
    </section>
  );
}
