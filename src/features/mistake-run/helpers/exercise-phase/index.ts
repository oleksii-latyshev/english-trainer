import type { ExerciseView } from '@/core/mistakes';
import type { ExercisePhase } from '../../types';

export function exercisePhase(exercise: ExerciseView): ExercisePhase {
  const result = exercise.result;
  if (result === null) return 'open';
  switch (result.outcome) {
    case 'pass':
      return 'passed';
    case 'miss':
      return 'missed';
    case 'checking':
      return result.check_failed ? 'check-failed' : 'checking';
    case 'retry':
      return 'open';
  }
}

export function canTryOnceMore(exercise: ExerciseView): boolean {
  return exercisePhase(exercise) === 'missed' && exercise.result?.retried === false;
}
