import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { type AttemptComparison, isProviderError } from '@/lib/types';
import { retryPracticeTurn } from './sessionApi';

export type SecondTryStatus =
  | { tag: 'listening' }
  | { tag: 'comparing' }
  | { tag: 'error'; message: string };

type Options = {
  sessionId: number | undefined;
  /** What the capture transcribed; the second try once it arrives. */
  transcript: string | undefined;
  currentRequestId: number;
  onCompared: (sessionId: number, comparison: AttemptComparison) => void;
  resetCapture: () => void;
  startRecording: () => void;
};

function compareError(cause: unknown): string {
  return isProviderError(cause) ? cause.message : 'Could not compare this attempt. Please retry.';
}

/** "Say it again": one answer is re-spoken, then compared with the first try by Rust. */
export function useSecondTry(options: Options) {
  const { sessionId, transcript, currentRequestId, onCompared } = options;
  const [sequence, setSequence] = useState<number | null>(null);
  const [status, setStatus] = useState<SecondTryStatus>({ tag: 'listening' });
  const comparedKey = useRef('');
  // Bumped whenever the second try is started, cancelled or the screen closes: late results are dropped.
  const generation = useRef(0);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The callbacks only act on the settled comparison; the capture and the answer identify it.
  useEffect(() => {
    if (sequence === null || sessionId === undefined || !transcript?.trim()) return;
    const key = `${sessionId}:${sequence}:${currentRequestId}`;
    if (comparedKey.current === key) return;
    comparedKey.current = key;
    if (!isTauri()) {
      setStatus({ tag: 'error', message: 'Open the desktop app to compare this answer.' });
      return;
    }
    const attempt = generation.current;
    setStatus({ tag: 'comparing' });
    retryPracticeTurn(sessionId, sequence, transcript).then(
      (comparison) => {
        if (attempt !== generation.current) return;
        onCompared(sessionId, comparison);
        options.resetCapture();
        setSequence(null);
      },
      (cause: unknown) => {
        if (attempt === generation.current) {
          setStatus({ tag: 'error', message: compareError(cause) });
        }
      },
    );
  }, [sequence, sessionId, transcript, currentRequestId]);

  return {
    /** The answer being re-spoken, if any. */
    sequence,
    status,
    start: (answerSequence: number) => {
      comparedKey.current = '';
      generation.current += 1;
      setStatus({ tag: 'listening' });
      setSequence(answerSequence);
      options.resetCapture();
      options.startRecording();
    },
    cancel: () => {
      if (sequence === null) return;
      generation.current += 1;
      setSequence(null);
      options.resetCapture();
    },
  };
}
