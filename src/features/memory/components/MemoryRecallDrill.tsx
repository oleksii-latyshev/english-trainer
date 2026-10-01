import { useEffect, useRef, useState } from 'react';
import {
  getCompletedItemCount,
  getCurrentPendingItem,
  isRunFinished,
  mergeRecallResult,
} from '@/features/memory/lib/memoryRecallState';
import { finishMemoryReview, submitMemoryRecall } from '@/features/memory/memoryRecallApi';
import { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { MemoryRecallResult, MemoryReviewRun } from '@/lib/memoryRecallTypes';
import { MemoryRecallDrillView } from './MemoryRecallDrillView';

type Props = {
  run: MemoryReviewRun;
  speech: ReturnType<typeof useSystemSpeech>;
  onFinish: () => void;
  onRunUpdated: (updated: MemoryReviewRun) => void;
  onCaptureBusyChange: (busy: boolean) => void;
};

export function MemoryRecallDrill({
  run,
  speech,
  onFinish,
  onRunUpdated,
  onCaptureBusyChange,
}: Props) {
  const capture = useSpeechCapture(speech);
  const [latestResult, setLatestResult] = useState<MemoryRecallResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const savingRef = useRef(false);
  const finishingRef = useRef(false);
  const mountedRef = useRef(false);
  const isCaptureBusy = !capture.canChangeSession;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onCaptureBusyChange(isCaptureBusy);
  }, [isCaptureBusy, onCaptureBusyChange]);

  const currentPending = getCurrentPendingItem(run.items);
  const allCompleted = isRunFinished(run.items);
  const completedCount = getCompletedItemCount(run.items);

  async function handleEndReview() {
    if (finishingRef.current || savingRef.current || isCaptureBusy) return;
    finishingRef.current = true;
    setIsFinishing(true);
    setActionError(null);
    try {
      await finishMemoryReview(run.run_id);
      if (mountedRef.current) {
        capture.reset();
        onFinish();
      }
    } catch {
      if (mountedRef.current) {
        setActionError(
          'Could not finish this review. Your saved answers are safe; retry when ready.',
        );
      }
    } finally {
      finishingRef.current = false;
      if (mountedRef.current) setIsFinishing(false);
    }
  }

  async function handleSaveRecall() {
    const transcript = capture.view.transcript;
    if (
      savingRef.current ||
      finishingRef.current ||
      isCaptureBusy ||
      !transcript ||
      !currentPending
    )
      return;
    if ([...transcript].length > 4000) {
      if (mountedRef.current) {
        setSaveError(
          'This transcript exceeds 4000 characters. Record a shorter answer to save it.',
        );
      }
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    setActionError(null);
    try {
      const result = await submitMemoryRecall(
        run.run_id,
        currentPending.item_type,
        currentPending.item_id,
        transcript,
      );
      if (!mountedRef.current) return;
      const updated = mergeRecallResult(run, result);
      onRunUpdated(updated);
      setLatestResult(result);
      capture.reset();
    } catch {
      if (mountedRef.current) {
        setSaveError('Could not save this recall. Your transcript is still here so you can retry.');
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  }

  function handleNext() {
    if (savingRef.current || finishingRef.current || isCaptureBusy) return;
    capture.reset();
    setLatestResult(null);
    setSaveError(null);
    setActionError(null);
  }

  return (
    <MemoryRecallDrillView
      actionError={actionError}
      allCompleted={allCompleted}
      capture={capture}
      completedCount={completedCount}
      currentPending={currentPending}
      isCaptureBusy={isCaptureBusy}
      isFinishing={isFinishing}
      isSaving={isSaving}
      latestResult={latestResult}
      onEndReview={() => void handleEndReview()}
      onNext={handleNext}
      onSaveRecall={() => void handleSaveRecall()}
      run={run}
      saveError={saveError}
    />
  );
}
