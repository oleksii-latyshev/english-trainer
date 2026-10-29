import type { ExerciseView } from '@/core/mistakes';
import { exercisePhase } from '../../helpers/exercise-phase';

type Props = { exercise: ExerciseView; heard: string };

const NOTE =
  'border-ok-line bg-ok-bg rounded-control flex w-full max-w-xl flex-col gap-1.5 border px-5 py-4 text-left';

export function ResultNote({ exercise, heard }: Props) {
  const result = exercise.result;
  const phase = exercisePhase(exercise);
  if (result === null) return null;
  if (phase === 'checking') {
    return (
      <div className={NOTE} role="status">
        <b>Eva is checking your answer.</b>
        <span className="text-muted">
          You can carry on. The result appears here when it is ready.
        </span>
        {heard && <span className="text-muted">You said: “{heard}”</span>}
      </div>
    );
  }
  if (phase === 'check-failed') {
    return (
      <div className={NOTE} role="alert">
        <b>We could not check this answer.</b>
        <span className="text-muted">Your schedule stays as it was. Try the check again.</span>
      </div>
    );
  }
  return (
    <div className={NOTE} role="status">
      <b>{result.note}</b>
      {phase === 'missed' && <span data-word-lookup>“{result.keep}”</span>}
      {heard && <span className="text-muted">You said: “{heard}”</span>}
      {result.lesson && (
        <span className="text-muted" data-word-lookup>
          {result.lesson}
        </span>
      )}
      {result.retry_note && <span className="text-muted">{result.retry_note}</span>}
    </div>
  );
}
