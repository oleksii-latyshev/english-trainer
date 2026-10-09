import { useEffect, useState } from 'react';
import { getSpeechEngineStatus, type SpeechEngineStatus } from '@/lib/speechTypes';

const REFRESH_MS = 1500;

/**
 * The state of the model kept in memory. It changes without the Settings screen doing anything
 * (loading finishes, the server stops), so it is asked for again while the group is open.
 */
export function useSpeechEngineStatus(refreshKey: string): SpeechEngineStatus | undefined {
  const [status, setStatus] = useState<SpeechEngineStatus>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: A new model or switch value asks for the status again at once.
  useEffect(() => {
    let isCurrent = true;
    const refresh = () =>
      getSpeechEngineStatus().then(
        (next) => {
          if (isCurrent) setStatus(next);
        },
        () => {
          // Keep the last known state; the next refresh tries again.
        },
      );
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      isCurrent = false;
      clearInterval(timer);
    };
  }, [refreshKey]);

  return status;
}
