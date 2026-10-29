import { useAtomMount, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { isLastPosition, isSummary, positionOf } from '../../helpers/run-position';
import { cursorAtom, finishEffectAtom, runAtom } from '../../model/atoms';
import { spokenEffectsAtom, spokenGuardAtom } from '../../model/spoken';
import { ExerciseStage } from '../exercise-stage';
import { RunSummary } from '../run-summary';

type Props = {
  runId: number;
  micBlockedReason: string | null;
  onLeave: () => void;
};

export function RunBody({ runId, micBlockedReason, onLeave }: Props) {
  useAtomMount(spokenEffectsAtom);
  useAtomMount(spokenGuardAtom);
  useAtomMount(finishEffectAtom(runId));
  const result = useAtomValue(runAtom(runId));
  const cursor = useAtomValue(cursorAtom(runId));
  const reload = useAtomRefresh(runAtom(runId));
  return AsyncResult.match(result, {
    onInitial: () => (
      <Notice role="status" tone="quiet">
        Opening your practice…
      </Notice>
    ),
    onFailure: () => (
      <Notice className="rounded-control flex items-center gap-3 border" role="alert" tone="quiet">
        <span className="flex-1">Could not open this practice.</span>
        <Button onClick={reload} size="sm" tone="secondary">
          Try again
        </Button>
        <Button onClick={onLeave} size="sm" tone="quiet">
          Back to Mistakes
        </Button>
      </Notice>
    ),
    onSuccess: ({ value }) => {
      if (isSummary(value, cursor)) return <RunSummary onLeave={onLeave} run={value} />;
      const position = positionOf(value, cursor);
      const exercise = value.items[position];
      if (exercise === undefined) return <RunSummary onLeave={onLeave} run={value} />;
      return (
        <ExerciseStage
          exercise={exercise}
          isLast={isLastPosition(value, position)}
          key={exercise.position}
          micBlockedReason={micBlockedReason}
          runId={runId}
        />
      );
    },
  });
}
