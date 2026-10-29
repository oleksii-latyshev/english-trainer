import { RegistryContext, useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import { type ExerciseView, stepLabel } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { exerciseKey } from '../../helpers/exercise-key';
import { canTryOnceMore, exercisePhase } from '../../helpers/exercise-phase';
import { askedLabel, instruction } from '../../helpers/run-copy';
import {
  checkAnswerAtom,
  cursorAtom,
  draftAtom,
  heardAtom,
  retryCheckAtom,
  retryOpenAtom,
  submitAnswerAtom,
} from '../../model/atoms';
import { FixAnswer } from '../fix-answer';
import { GapAnswer } from '../gap-answer';
import { ResultNote } from '../result-note';
import { SpokenAnswer } from '../spoken-answer';

type Props = {
  runId: number;
  exercise: ExerciseView;
  isLast: boolean;
  micBlockedReason: string | null;
};

function AnswerInput(props: Props) {
  const { runId, exercise } = props;
  const key = exerciseKey(runId, exercise.position);
  const [submitted, submit] = useAtom(submitAnswerAtom);
  const isSaving = AsyncResult.isWaiting(submitted);
  function send(answer: string) {
    submit({ runId, position: exercise.position, answer, input: 'typed' });
  }
  if (exercise.step === 1 && exercise.sentence) {
    return (
      <GapAnswer
        draftKey={key}
        isEditable
        isSaving={isSaving}
        keep={null}
        onSubmit={send}
        sentence={exercise.sentence}
      />
    );
  }
  if (exercise.step === 2) {
    return (
      <FixAnswer draftKey={key} isSaving={isSaving} onSubmit={send} said={exercise.said ?? ''} />
    );
  }
  return (
    <SpokenAnswer
      blockedReason={props.micBlockedReason}
      isSaving={isSaving}
      position={exercise.position}
      question={exercise.question}
      runId={runId}
    />
  );
}

function Outcome({ runId, exercise, isLast }: Omit<Props, 'micBlockedReason'>) {
  const registry = useContext(RegistryContext);
  const key = exerciseKey(runId, exercise.position);
  const heard = useAtomValue(heardAtom(key));
  const phase = exercisePhase(exercise);
  const result = exercise.result;
  const isChecking = AsyncResult.isWaiting(useAtomValue(checkAnswerAtom));
  const check = useAtomSet(checkAnswerAtom);
  const retryCheck = useAtomSet(retryCheckAtom);
  return (
    <>
      {exercise.step === 1 && exercise.sentence && (
        <GapAnswer
          draftKey={key}
          isEditable={false}
          isSaving={false}
          keep={result?.keep ?? null}
          onSubmit={() => undefined}
          sentence={exercise.sentence}
        />
      )}
      <ResultNote exercise={exercise} heard={heard} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        {phase === 'check-failed' && result && (
          <Button
            onClick={() => retryCheck({ runId, attemptId: result.attempt_id })}
            tone="secondary"
          >
            Retry
          </Button>
        )}
        {phase === 'missed' && result?.can_check && (
          <Button
            onClick={() => check({ runId, position: exercise.position })}
            pending={isChecking}
            tone="secondary"
          >
            Check it
          </Button>
        )}
        {canTryOnceMore(exercise) && (
          <Button
            onClick={() => {
              registry.set(draftAtom(key), []);
              registry.set(retryOpenAtom(key), true);
            }}
            tone="secondary"
          >
            Try once more
          </Button>
        )}
        <Button
          onClick={() => registry.set(cursorAtom(runId), exercise.position + 1)}
          tone="primary"
        >
          {isLast ? 'Finish' : 'Next →'}
        </Button>
      </div>
    </>
  );
}

export function ExerciseStage(props: Props) {
  const { runId, exercise } = props;
  const key = exerciseKey(runId, exercise.position);
  const isRetryOpen = useAtomValue(retryOpenAtom(key));
  const showsInput =
    exercisePhase(exercise) === 'open' || (isRetryOpen && canTryOnceMore(exercise));
  return (
    <GlassPanel
      aria-label={stepLabel(exercise.step)}
      className="flex flex-1 flex-col items-center justify-center gap-6 px-10 py-10 text-center"
    >
      <div className="text-faint text-xs tracking-wide uppercase">{stepLabel(exercise.step)}</div>
      <p className="text-muted m-0" data-word-lookup>
        {askedLabel(exercise.step)}: {exercise.question}
      </p>
      <p className="text-faint m-0 text-xs">
        {showsInput && isRetryOpen
          ? 'Practice only. It does not change your schedule.'
          : instruction(exercise.step)}
      </p>
      {showsInput ? (
        <AnswerInput {...props} />
      ) : (
        <Outcome exercise={exercise} isLast={props.isLast} runId={runId} />
      )}
    </GlassPanel>
  );
}
