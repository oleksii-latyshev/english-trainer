import { useCallback, useEffect, useRef, useState } from 'react';
import {
  countdownLabel,
  countdownRemainingMs,
  isCountdownDue,
  type SendCountdown,
  startSendCountdown,
} from './lib/sendCountdown';

const TICK_MS = 100;

/** Runs the visible edit window; `onDue` fires once if nothing cancelled it first. */
export function useAutoSendCountdown(onDue: (text: string) => void) {
  const [countdown, setCountdown] = useState<SendCountdown | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const onDueRef = useRef(onDue);
  onDueRef.current = onDue;

  useEffect(() => {
    if (!countdown) return;
    const timer = setInterval(() => {
      const now = performance.now();
      if (isCountdownDue(countdown, now)) {
        clearInterval(timer);
        setCountdown(null);
        onDueRef.current(countdown.text);
        return;
      }
      setNowMs(now);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [countdown]);

  const start = useCallback((text: string, delayMs: number) => {
    const now = performance.now();
    setNowMs(now);
    setCountdown(startSendCountdown(text, now, delayMs));
  }, []);
  const cancel = useCallback(() => setCountdown(null), []);

  return {
    active: countdown !== null,
    label: countdown
      ? countdownLabel(countdownRemainingMs(countdown, nowMs || performance.now()))
      : '',
    start,
    cancel,
  };
}
