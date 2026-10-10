import { useCallback, useRef } from 'react';

/** Planning keeps the microphone warm but suppresses automatic capture until a manual press. */
export function usePlanningGuard(cancelRecording: () => void, startAutoListen: () => void) {
  const active = useRef(false);
  const latest = useRef({ cancelRecording, startAutoListen });
  latest.current = { cancelRecording, startAutoListen };
  const onPlanningChange = useCallback((isPlanning: boolean) => {
    active.current = isPlanning;
    if (isPlanning) latest.current.cancelRecording();
  }, []);
  const listen = useCallback(() => {
    if (!active.current) latest.current.startAutoListen();
  }, []);
  return { onPlanningChange, startAutoListen: listen };
}
