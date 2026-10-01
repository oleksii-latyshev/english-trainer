import { Button, Chip } from '@heroui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MemoryItemLibrary } from '@/features/memory/components/MemoryItemLibrary';
import { MemoryRecallDrill } from '@/features/memory/components/MemoryRecallDrill';
import { applyReviewResult, type MemoryFilter } from '@/features/memory/lib/memoryState';
import { getMemoryReview, startMemoryReview } from '@/features/memory/memoryRecallApi';
import type { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { LearningMemoryView, ReviewResponse } from '@/lib/learningTypes';
import type { MemoryReviewRun } from '@/lib/memoryRecallTypes';
import { getLearningMemory, submitLearningReview } from './memoryApi';

type Props = {
  onClose?: () => void;
  capture?: ReturnType<typeof useSpeechCapture>;
  speech?: ReturnType<typeof useSystemSpeech>;
  practiceBusy?: boolean;
};

export function LearningMemoryPanel({ onClose, capture, speech, practiceBusy }: Props) {
  const [view, setView] = useState<LearningMemoryView>({
    mistakes: [],
    phrase_cards: [],
    due_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MemoryFilter>('all');
  const [activeRun, setActiveRun] = useState<MemoryReviewRun | null>(null);
  const [isReviewActive, setIsReviewActive] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);
  const [isDrillCaptureBusy, setIsDrillCaptureBusy] = useState(false);
  const [isStartingReview, setIsStartingReview] = useState(false);
  const startingReviewRef = useRef(false);
  const activeRunCheckRef = useRef(0);
  const loadCheckRef = useRef(0);
  const mountedRef = useRef(false);
  const isReviewActiveRef = useRef(false);

  const isAudioBusy =
    practiceBusy || isDrillCaptureBusy || (capture !== undefined && !capture.canChangeSession);

  const loadMemory = useCallback(async () => {
    const requestId = ++loadCheckRef.current;
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getLearningMemory(true);
      if (mountedRef.current && requestId === loadCheckRef.current) setView(data);
    } catch {
      if (mountedRef.current && requestId === loadCheckRef.current) {
        setFetchError('Could not load Learning Memory from local storage. Please retry.');
      }
    } finally {
      if (mountedRef.current && requestId === loadCheckRef.current) setLoading(false);
    }
  }, []);

  const checkActiveRun = useCallback(async () => {
    const requestId = ++activeRunCheckRef.current;
    try {
      const run = await getMemoryReview();
      if (mountedRef.current && requestId === activeRunCheckRef.current) {
        setActiveRun(run);
        setDrillError(null);
      }
    } catch {
      if (mountedRef.current && requestId === activeRunCheckRef.current) {
        setDrillError('Could not load your saved voice review. Retry to restore its progress.');
      }
    }
  }, []);

  const handleCaptureBusyChange = useCallback((busy: boolean) => {
    setIsDrillCaptureBusy((current) => (current === busy ? current : busy));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadMemory();
    void checkActiveRun();
    const refreshMemory = () => {
      void loadMemory();
      if (!isReviewActiveRef.current) void checkActiveRun();
    };
    window.addEventListener('learning-memory-changed', refreshMemory);
    return () => {
      mountedRef.current = false;
      activeRunCheckRef.current += 1;
      loadCheckRef.current += 1;
      window.removeEventListener('learning-memory-changed', refreshMemory);
    };
  }, [loadMemory, checkActiveRun]);

  async function handleMistakeReview(id: number, response: ReviewResponse) {
    const result = await submitLearningReview('mistake', id, response);
    setView((current) => applyReviewResult(current, result));
  }

  async function handlePhraseReview(id: number, response: ReviewResponse) {
    const result = await submitLearningReview('phrase', id, response);
    setView((current) => applyReviewResult(current, result));
  }

  async function handleStartOrResumeReview() {
    if (isAudioBusy || startingReviewRef.current) return;
    setDrillError(null);
    if (activeRun) {
      activeRunCheckRef.current += 1;
      isReviewActiveRef.current = true;
      capture?.reset();
      setIsReviewActive(true);
      return;
    }
    startingReviewRef.current = true;
    setIsStartingReview(true);
    try {
      const newRun = await startMemoryReview();
      if (!mountedRef.current) return;
      if (!newRun || newRun.items.length === 0) {
        setDrillError(
          'No due items have safe, usable cues right now. Your saved items remain unchanged.',
        );
        return;
      }
      activeRunCheckRef.current += 1;
      isReviewActiveRef.current = true;
      capture?.reset();
      setActiveRun(newRun);
      setIsReviewActive(true);
    } catch {
      setDrillError('Could not start voice recall drill. Please retry.');
    } finally {
      startingReviewRef.current = false;
      if (mountedRef.current) setIsStartingReview(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
              PERSISTENT KNOWLEDGE BANK
            </span>
            <Chip color={view.due_count > 0 ? 'warning' : 'success'} size="sm" variant="soft">
              {view.due_count > 0 ? `${view.due_count} Due for Review` : 'All Caught Up'}
            </Chip>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
            Learning Memory & Mistake Vault
          </h1>
          <p className="text-sm text-zinc-400">
            Long-term Spaced Repetition (SRS) for corrected Slavicisms, high-value collocations, and
            vocabulary recorded from your speaking sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isReviewActive && (
            <Button
              className="border border-purple-500/40 bg-purple-500/20 text-xs font-medium text-purple-200 hover:bg-purple-500/30"
              isDisabled={isAudioBusy || loading || isStartingReview}
              onPress={() => void handleStartOrResumeReview()}
              size="sm"
            >
              {isStartingReview
                ? 'Starting review…'
                : activeRun
                  ? 'Resume voice review'
                  : 'Start voice review'}
            </Button>
          )}
          {onClose && !isReviewActive && (
            <Button
              className="self-start border border-white/10 bg-white/[0.06] text-xs text-zinc-200 hover:bg-white/10 md:self-auto"
              isDisabled={isAudioBusy}
              onPress={onClose}
              size="sm"
              variant="secondary"
            >
              Back to Practice
            </Button>
          )}
        </div>
      </div>

      {drillError && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
          <span>{drillError}</span>
          <div className="flex gap-2">
            <Button
              className="text-xs"
              isDisabled={isAudioBusy}
              onPress={() => void handleStartOrResumeReview()}
              size="sm"
              variant="secondary"
            >
              Retry
            </Button>
            <Button
              className="text-xs"
              onPress={() => setDrillError(null)}
              size="sm"
              variant="secondary"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {isReviewActive && activeRun && capture && speech ? (
        <MemoryRecallDrill
          onCaptureBusyChange={handleCaptureBusyChange}
          onFinish={() => {
            activeRunCheckRef.current += 1;
            isReviewActiveRef.current = false;
            setIsReviewActive(false);
            setActiveRun(null);
            void loadMemory();
            void checkActiveRun();
          }}
          onRunUpdated={(updated) => {
            activeRunCheckRef.current += 1;
            setActiveRun(updated);
          }}
          run={activeRun}
          speech={speech}
        />
      ) : (
        <MemoryItemLibrary
          fetchError={fetchError}
          filter={filter}
          loading={loading}
          onFilterChange={setFilter}
          onMistakeReview={handleMistakeReview}
          onPhraseReview={handlePhraseReview}
          onRetryLoad={() => void loadMemory()}
          view={view}
        />
      )}
    </div>
  );
}
