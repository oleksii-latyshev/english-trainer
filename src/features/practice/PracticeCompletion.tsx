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
        <p className="m-0 text-xs text-slate-400">
          These counts come from saved conversation turns and Try Again attempts. A language
          progress assessment is not available for this session yet.
        </p>
        <Button className="self-start" onPress={onDone} variant="primary">
          Back to Home
        </Button>
      </Card.Content>
    </Card>
  );
}
