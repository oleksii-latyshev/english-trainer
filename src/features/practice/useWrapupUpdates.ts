import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef } from 'react';
import type { FinishedPracticeSession } from '@/lib/finishedPracticeSession';
import { getSessionWrapup } from './sessionApi';
import { useCoachingUpdates } from './useCoachingUpdates';

/**
 * Keeps a wrap-up that still waits for coaching current: when Rust reports that a batch landed,
 * the wrap-up is read again. Nothing is read once all answers are checked.
 */
export function useWrapupUpdates(
  summary: FinishedPracticeSession,
  onUpdated: (summary: FinishedPracticeSession) => void,
) {
  const isWaiting = summary.pending_coaching > 0;
  const sessionId = summary.session_id;
  const latest = useRef(onUpdated);
  latest.current = onUpdated;
  const generation = useRef(0);

  function refresh() {
    if (!isTauri()) return;
    const attempt = ++generation.current;
    getSessionWrapup(sessionId).then(
      (fresh) => {
        if (attempt === generation.current) latest.current(fresh);
      },
      // The wrap-up on screen stays valid; the next landing batch tries again.
      (cause: unknown) => console.warn('Could not refresh the session wrap-up.', cause),
    );
  }

  useCoachingUpdates(isWaiting ? sessionId : undefined, refresh);

  // A batch may have landed between finishing and listening, so read once when the wait starts.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh only reads the session this effect is keyed on.
  useEffect(() => {
    if (isWaiting) refresh();
    return () => {
      generation.current += 1;
    };
  }, [isWaiting, sessionId]);
}
