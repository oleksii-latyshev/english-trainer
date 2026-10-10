import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import { COACHING_UPDATED_EVENT, isCoachingEvent } from '@/lib/coachingTypes';
import type { FinishedPracticeSession } from '@/lib/finishedPracticeSession';
import { isWrapupEvent, WRAPUP_UPDATED_EVENT } from '@/lib/wrapupTypes';
import { getSessionWrapup } from './sessionApi';

/** Refreshes the finished-session snapshot when coaching or phrase preparation lands. */
export function useWrapupUpdates(
  summary: FinishedPracticeSession,
  onUpdated: (summary: FinishedPracticeSession) => void,
) {
  const sessionId = summary.session_id;
  const isWaitingForCoaching = summary.pending_coaching > 0 || summary.is_coaching_paused;
  const isPreparingPhrases = summary.wrapup_preparation?.state === 'pending';
  const latest = useRef(onUpdated);
  latest.current = onUpdated;
  const generation = useRef(0);

  useEffect(() => {
    if ((!isWaitingForCoaching && !isPreparingPhrases) || !isTauri()) return;
    let isCurrent = true;
    let unlistenCoaching: (() => void) | undefined;
    let unlistenWrapup: (() => void) | undefined;
    const refresh = () => {
      const attempt = ++generation.current;
      getSessionWrapup(sessionId).then(
        (fresh) => {
          if (isCurrent && attempt === generation.current && fresh.session_id === sessionId) {
            latest.current(fresh);
          }
        },
        (cause: unknown) => console.warn('Could not refresh the session wrap-up.', cause),
      );
    };

    const subscriptions = [
      isWaitingForCoaching
        ? listen<unknown>(COACHING_UPDATED_EVENT, (event) => {
            if (isCoachingEvent(event.payload) && event.payload.session_id === sessionId) refresh();
          }).then((stop) => {
            if (isCurrent) unlistenCoaching = stop;
            else stop();
          })
        : Promise.resolve(),
      isPreparingPhrases
        ? listen<unknown>(WRAPUP_UPDATED_EVENT, (event) => {
            if (isWrapupEvent(event.payload) && event.payload.session_id === sessionId) refresh();
          }).then((stop) => {
            if (isCurrent) unlistenWrapup = stop;
            else stop();
          })
        : Promise.resolve(),
    ];

    // Subscribe first so a result cannot land in the gap between our snapshot and listener setup.
    void Promise.allSettled(subscriptions).then((results) => {
      for (const result of results) {
        if (result.status === 'rejected') {
          console.warn('Could not subscribe to session updates.', result.reason);
        }
      }
      if (isCurrent) refresh();
    });

    return () => {
      isCurrent = false;
      generation.current += 1;
      unlistenCoaching?.();
      unlistenWrapup?.();
    };
  }, [isPreparingPhrases, isWaitingForCoaching, sessionId]);
}
