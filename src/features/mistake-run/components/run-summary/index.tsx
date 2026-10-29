import { useAtom } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { type RunView, stepLabel } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { exercisePhase } from '../../helpers/exercise-phase';
import { outcomeLabel, tally, tallyLine } from '../../helpers/run-copy';
import { retryCheckAtom } from '../../model/atoms';

type Props = { run: RunView; onLeave: () => void };

const TONES = {
  passed: 'success',
  missed: 'warning',
  checking: 'neutral',
  'check-failed': 'neutral',
  open: 'neutral',
} as const;

export function RunSummary({ run, onLeave }: Props) {
  const [retried, retryCheck] = useAtom(retryCheckAtom);
  const isRetrying = AsyncResult.isWaiting(retried);
  return (
    <GlassPanel
      aria-label="Practice summary"
      className="flex flex-1 flex-col items-center justify-center gap-6 px-10 py-10 text-center"
    >
      <h2 className="m-0 text-2xl font-bold">Practice done</h2>
      <p className="text-muted m-0">{tallyLine(tally(run), run.items.length)}</p>
      <ul className="m-0 flex w-full max-w-2xl list-none flex-col gap-2 p-0">
        {run.items.map((exercise) => (
          <li
            className="border-line flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2 text-left"
            key={exercise.position}
          >
            <Chip>{stepLabel(exercise.step)}</Chip>
            <span className="min-w-0 flex-1 truncate" data-word-lookup>
              {exercise.result?.keep || exercise.question}
            </span>
            <Chip tone={TONES[exercisePhase(exercise)]}>{outcomeLabel(exercise)}</Chip>
            {exercise.result && exercisePhase(exercise) === 'check-failed' && (
              <Button
                disabled={isRetrying}
                onClick={() => {
                  if (exercise.result) {
                    retryCheck({ runId: run.run_id, attemptId: exercise.result.attempt_id });
                  }
                }}
                size="sm"
                tone="secondary"
              >
                Retry
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button onClick={onLeave} tone="primary">
        Back to Mistakes
      </Button>
    </GlassPanel>
  );
}
