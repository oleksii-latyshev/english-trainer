import { useEffect, useRef } from 'react';
import type { PracticeSession } from '@/lib/practiceSessionTypes';
import { setPracticeClock } from './sessionApi';

const CLOCK_QUEUE = { current: Promise.resolve() };

async function applyClockUpdate(options: {
  sessionId: number;
  running: boolean;
  shouldSend: () => boolean;
  isCurrent: () => boolean;
  isLatestSession: () => boolean;
  isRequesting: { current: boolean };
  onSnapshot: (session: PracticeSession) => void;
  onError: (cause: unknown) => void;
}) {
  if (!options.shouldSend()) return;
  options.isRequesting.current = true;
  try {
    const session = await setPracticeClock(options.sessionId, options.running);
    if (options.isCurrent() && options.isLatestSession()) options.onSnapshot(session);
  } catch (cause) {
    if (options.isCurrent()) options.onError(cause);
  } finally {
    options.isRequesting.current = false;
  }
}

/** Starts the Rust clock only while this route is visible and the learner has not paused the mic. */
export function useSessionClock(options: {
  sessionId: number | undefined;
  isSessionActive: boolean;
  isMicPaused: boolean;
  onSnapshot: (session: PracticeSession) => void;
  onError: (cause: unknown) => void;
}) {
  const { sessionId, isSessionActive, isMicPaused, onSnapshot, onError } = options;
  const currentSession = useRef(sessionId);
  const queue = CLOCK_QUEUE;
  const isRequesting = useRef(false);
  currentSession.current = sessionId;

  useEffect(() => {
    if (sessionId === undefined || !isSessionActive) return;
    const activeSessionId = sessionId;
    let isCurrent = true;
    function checkpoint(running: boolean, mustBeCurrent = true) {
      queue.current = queue.current
        .catch((cause: unknown) => {
          if (isCurrent) onError(cause);
        })
        .then(() =>
          applyClockUpdate({
            sessionId: activeSessionId,
            running,
            shouldSend: () => !mustBeCurrent || isCurrent,
            isCurrent: () => isCurrent,
            isLatestSession: () => currentSession.current === activeSessionId,
            isRequesting,
            onSnapshot,
            onError,
          }),
        );
    }

    const isRunning = !isMicPaused;
    checkpoint(isRunning);
    const timer = isRunning
      ? window.setInterval(() => {
          if (!isRequesting.current) checkpoint(true);
        }, 15_000)
      : undefined;

    return () => {
      isCurrent = false;
      if (timer !== undefined) window.clearInterval(timer);
      checkpoint(false, false);
    };
  }, [sessionId, isSessionActive, isMicPaused, onSnapshot, onError]);
}
