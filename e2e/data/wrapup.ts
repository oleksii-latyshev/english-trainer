import type { FinishedPracticeSession } from '@/core/ipc';
import { finishedSession } from './sessions';

export function wrapupSummary(
  wrapupPreparation: FinishedPracticeSession['wrapup_preparation'],
  phrases = finishedSession.phrases,
  pendingCoaching = 0,
): FinishedPracticeSession {
  return {
    ...finishedSession,
    wrapup_preparation: wrapupPreparation,
    phrases,
    pending_coaching: pendingCoaching,
  };
}
