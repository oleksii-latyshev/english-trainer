import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import { COACHING_UPDATED_EVENT, isCoachingEvent } from '@/lib/coachingTypes';

/**
 * Calls `onUpdated` when Rust says coaching landed for the session. The queue pushes the news, so
 * the screen never polls.
 */
export function useCoachingUpdates(sessionId: number | undefined, onUpdated: () => void) {
  // The latest callback is read when an event arrives, so the listener is set up once per session.
  const latest = useRef(onUpdated);
  latest.current = onUpdated;

  useEffect(() => {
    if (sessionId === undefined || !isTauri()) return;
    let isCurrent = true;
    let unlisten: (() => void) | undefined;
    void listen<unknown>(COACHING_UPDATED_EVENT, (event) => {
      if (isCoachingEvent(event.payload) && event.payload.session_id === sessionId) {
        latest.current();
      }
    }).then((stop) => {
      if (isCurrent) unlisten = stop;
      else stop();
    });
    return () => {
      isCurrent = false;
      unlisten?.();
    };
  }, [sessionId]);
}
