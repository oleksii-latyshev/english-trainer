type Props = {
  isComplete: boolean;
  question: string;
  spokenTurnCount: number;
  writtenTurnCount: number;
};

export function OriginalQuestionPrompt({
  isComplete,
  question,
  spokenTurnCount,
  writtenTurnCount,
}: Props) {
  return (
    <section aria-label="Current original question" className="talk-original-question">
      <span>
        {isComplete
          ? 'Replay complete'
          : `Original question ${spokenTurnCount + 1} of ${writtenTurnCount}`}
      </span>
      <p>{isComplete ? 'All original questions are answered.' : question}</p>
    </section>
  );
}
