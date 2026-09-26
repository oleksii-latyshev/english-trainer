import { Button, Card } from '@heroui/react';
import type { FinishedPracticeSession } from '@/lib/types';

type Props = {
  summary: FinishedPracticeSession;
  onDone: () => void;
};

export function PracticeCompletion({ summary, onDone }: Props) {
  const goalReached = summary.turn_count >= summary.target_turns;
  return (
    <Card className="panel max-w-2xl" variant="secondary">
      <Card.Header>
        <div>
          <p className="section-kicker">DAILY PRACTICE COMPLETE</p>
          <Card.Title>Session saved</Card.Title>
        </div>
      </Card.Header>
      <Card.Content className="space-y-4">
        <p className="m-0 text-slate-200">
          You spoke through {summary.turn_count} {summary.turn_count === 1 ? 'answer' : 'answers'}
          {summary.retry_count > 0
            ? ` and re-spoke ${summary.retry_count} ${summary.retry_count === 1 ? 'answer' : 'answers'}`
            : ''}
          .
        </p>
        <p className="m-0 text-sm text-slate-400">
          {goalReached
            ? `You reached the ${summary.target_turns}-answer practice goal.`
            : `You ended before the suggested ${summary.target_turns}-answer goal. Short sessions count too.`}
        </p>
        <p className="m-0 text-sm text-slate-300">
          {summary.recall_count} spoken phrase recall{' '}
          {summary.recall_count === 1 ? 'attempt' : 'attempts'} saved; saved wording appeared in{' '}
          {summary.recall_wording_count}{' '}
          {summary.recall_wording_count === 1 ? 'transcript' : 'transcripts'}.
        </p>
        <section aria-label="Session learning highlights" className="space-y-3">
          <div>
            <h3 className="m-0 text-sm font-semibold text-slate-100">One thing you used again</h3>
            {summary.improvement ? (
              <p className="mt-1 mb-0 text-sm text-slate-300">
                In Try Again for answer {summary.improvement.turn_sequence}, your transcript newly
                included “{summary.improvement.target}”.
              </p>
            ) : (
              <p className="mt-1 mb-0 text-sm text-slate-400">
                No newly used target wording was saved in a Try Again attempt.
              </p>
            )}
          </div>
          <div>
            <h3 className="m-0 text-sm font-semibold text-slate-100">One focus for next time</h3>
            {summary.focus ? (
              <p className="mt-1 mb-0 text-sm text-slate-300">
                From answer {summary.focus.turn_sequence}: “{summary.focus.original}” → “
                {summary.focus.improved}”. {summary.focus.explanation}
              </p>
            ) : (
              <p className="mt-1 mb-0 text-sm text-slate-400">
                No focused correction was saved for this session.
              </p>
            )}
          </div>
          <div>
            <h3 className="m-0 text-sm font-semibold text-slate-100">Phrases you saved</h3>
            {summary.saved_phrases.length > 0 ? (
              <ul className="mt-1 mb-0 list-disc pl-5 text-sm text-slate-300">
                {summary.saved_phrases.map((phrase) => (
                  <li key={phrase}>{phrase}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 mb-0 text-sm text-slate-400">
                No phrase cards were saved from this session.
              </p>
            )}
          </div>
        </section>
        <p className="m-0 text-xs text-slate-400">
          These counts come from saved conversation turns, Try Again attempts, and spoken recall
          transcripts. Wording observed in a transcript is not a fluency or mastery assessment.
        </p>
        <Button className="self-start" onPress={onDone} variant="primary">
          Back to Home
        </Button>
      </Card.Content>
    </Card>
  );
}
