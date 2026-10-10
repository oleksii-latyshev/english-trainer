import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { mergeReviewMaterials } from '@/features/memory/lib/reviewMaterialsState';
import type { ReviewMaterials } from '@/lib/reviewMaterialTypes';
import { getReviewMaterial, prepareReviewMaterial, revealReviewPhrase } from './memoryRecallApi';

function beginRetry(
  epoch: { current: number },
  setMaterials: Dispatch<SetStateAction<ReviewMaterials | null>>,
): void {
  epoch.current += 1;
  setMaterials((current) =>
    current ? { ...current, preparation: { state: 'pending' } } : current,
  );
}

export function useReviewMaterials(runId: number) {
  const [materials, setMaterials] = useState<ReviewMaterials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const run = useRef(runId);
  const epoch = useRef(0);
  run.current = runId;

  const accept = useCallback((value: ReviewMaterials, requestEpoch: number, clearError = true) => {
    if (!alive.current || value.run_id !== run.current || requestEpoch !== epoch.current) return;
    setMaterials((current) => mergeReviewMaterials(current, value));
    if (clearError) setError(null);
  }, []);

  const refresh = useCallback(
    async (clearError = true) => {
      const requestEpoch = epoch.current;
      try {
        accept(await getReviewMaterial(runId), requestEpoch, clearError);
      } catch {
        if (alive.current && run.current === runId && epoch.current === requestEpoch) {
          setError(
            'Review materials could not be refreshed. Your saved items are unchanged; you can retry.',
          );
        }
      }
    },
    [accept, runId],
  );

  const prepare = useCallback(
    async (retry = false) => {
      if (retry) {
        beginRetry(epoch, setMaterials);
      }
      const requestEpoch = epoch.current;
      setBusy(true);
      setError(null);
      try {
        accept(await prepareReviewMaterial(runId, retry), requestEpoch);
      } catch {
        if (alive.current && run.current === runId && epoch.current === requestEpoch) {
          setError('Review situations could not be prepared. You can answer now or try again.');
          await refresh(false);
        }
      } finally {
        if (alive.current && run.current === runId && epoch.current === requestEpoch)
          setBusy(false);
      }
    },
    [accept, refresh, runId],
  );

  const reveal = useCallback(
    async (position: number) => {
      const requestEpoch = epoch.current;
      setError(null);
      try {
        accept(await revealReviewPhrase(runId, position), requestEpoch);
      } catch {
        if (alive.current && run.current === runId && epoch.current === requestEpoch)
          setError('Could not show the phrase. Please try again.');
      }
    },
    [accept, runId],
  );

  useEffect(() => {
    alive.current = true;
    void prepare();
    return () => {
      alive.current = false;
    };
  }, [prepare]);

  return { materials, error, busy, refresh, retry: () => void prepare(true), reveal };
}
