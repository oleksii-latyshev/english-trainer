import { isTauri } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PracticeDialogue } from '@/lib/dialogueTypes';
import { getPracticeDialogue } from './sessionApi';

type UsePracticeDialogueProps = {
  sessionId?: number;
  turnCount?: number;
  question?: string;
};

export type UsePracticeDialogueResult = {
  dialogue: PracticeDialogue | null;
  isLoading: boolean;
  error: string;
  refetch: () => void;
};

export function usePracticeDialogue({
  sessionId,
  turnCount,
  question,
}: UsePracticeDialogueProps): UsePracticeDialogueResult {
  const [dialogue, setDialogue] = useState<PracticeDialogue | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetchIndex, setFetchIndex] = useState(0);
  const activeSessionRef = useRef<number | undefined>(sessionId);

  const refetch = useCallback(() => {
    setFetchIndex((idx) => idx + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Saved turn count, prompt and explicit retry invalidate the external history read.
  useEffect(() => {
    if (activeSessionRef.current !== sessionId) {
      activeSessionRef.current = sessionId;
      setDialogue(null);
      setError('');
    }

    if (sessionId === undefined || !isTauri()) {
      return;
    }

    let isCurrent = true;
    setIsLoading(true);

    void getPracticeDialogue(sessionId)
      .then((data) => {
        if (!isCurrent) return;
        setDialogue(data);
        setError('');
        setIsLoading(false);
      })
      .catch(() => {
        if (!isCurrent) return;
        setIsLoading(false);
        // Retain existing stream on error retry/failure
        setError('Could not refresh dialogue history.');
      });

    return () => {
      isCurrent = false;
    };
  }, [sessionId, turnCount, question, fetchIndex]);

  return {
    dialogue,
    isLoading,
    error,
    refetch,
  };
}
