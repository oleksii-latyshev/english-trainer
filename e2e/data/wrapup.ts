import type { FinishedPracticeSession } from '@/core/ipc';
import { finishedSession } from './sessions';

export function wrapupSummary(pendingCoaching = 0): FinishedPracticeSession {
  return { ...finishedSession, pending_coaching: pendingCoaching };
}
