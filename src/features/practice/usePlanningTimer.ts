import { useEffect, useRef, useState } from 'react';
import { remainingPlanningSeconds } from './lib/planningTimer';

export function usePlanningTimer({
  isOpen,
  isRecording,
  isDisabled,
  onPlanningChange,
}: {
  isOpen: boolean;
  isRecording: boolean;
  isDisabled: boolean;
  onPlanningChange?: (active: boolean) => void;
}) {
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const callback = useRef(onPlanningChange);
  callback.current = onPlanningChange;
  const startedAt = useRef<number | null>(null);

  function cancel() {
    if (startedAt.current === null) return;
    startedAt.current = null;
    setDurationSeconds(null);
    setRemainingSeconds(0);
    callback.current?.(false);
  }
  const cancelLatest = useRef(cancel);
  cancelLatest.current = cancel;

  useEffect(() => {
    if (!isOpen || isRecording || isDisabled) cancelLatest.current();
  }, [isDisabled, isOpen, isRecording]);

  useEffect(() => {
    if (startedAt.current === null || durationSeconds === null) return;
    const started = startedAt.current;
    const update = () => {
      const remaining = remainingPlanningSeconds(started, Date.now(), durationSeconds);
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        startedAt.current = null;
        setDurationSeconds(null);
        callback.current?.(false);
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [durationSeconds]);

  useEffect(() => () => cancelLatest.current(), []);

  function start(seconds: number) {
    if (!isOpen || isRecording || isDisabled || (seconds !== 15 && seconds !== 30)) return;
    startedAt.current = Date.now();
    setDurationSeconds(seconds);
    setRemainingSeconds(seconds);
    callback.current?.(true);
  }

  return { durationSeconds, remainingSeconds, start, cancel };
}
