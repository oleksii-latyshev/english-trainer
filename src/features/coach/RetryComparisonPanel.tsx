import { Button } from '@heroui/react';
import { isTauri } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TurnNotice } from '@/features/practice/TurnNotice';
import { type AttemptComparison, isAttemptComparison, isProviderError } from '@/lib/types';

type Props = {
  original: string;
  retry?: string;
  attemptId: number;
  onCompare: (retryTranscript: string) => Promise<AttemptComparison>;
  onSaved: (comparison: AttemptComparison) => void;
  onContinue: () => void;
};

type State =
  | { tag: 'waiting' | 'loading' }
  | { tag: 'ready'; result: AttemptComparison }
  | { tag: 'error'; message: string };

function errorMessage(cause: unknown): string {
  return isProviderError(cause) ? cause.message : 'Could not compare this attempt. Please retry.';
}

type ReadyProps = {
  result: AttemptComparison;
  onContinue: () => void;
};

function RetryComparisonReady({ result, onContinue }: ReadyProps) {
  const wordDelta =
    result.word_count_change > 0 ? `+${result.word_count_change}` : `${result.word_count_change}`;

  return (
    <div aria-live="polite" className="talk-help-group">
      <div className="talk-compare">
        <div>
          <span className="talk-help-caption">Original attempt</span>
          <p>{result.original_transcript}</p>
        </div>
        <div data-retry="true">
          <span className="talk-help-caption">Second try</span>
          <p>{result.retry_transcript}</p>
        </div>
      </div>

      <div className="talk-pills">
        <span className="talk-pill">
          Target wording: {result.target_evidence.replace(/_/g, ' ')}
        </span>
        <span className="talk-pill">Word count change: {wordDelta}</span>
        <span className="talk-pill">Hesitation: {result.hesitation}</span>
      </div>

      {result.target.length === 0 && (
        <p className="talk-help-caption">
          No focused correction was available for a target wording comparison.
        </p>
      )}

      <div className="talk-card-actions">
        <Button onPress={onContinue} size="sm" variant="secondary">
          Continue with a new answer
        </Button>
      </div>
    </div>
  );
}

export function RetryComparisonPanel({
  original,
  retry,
  attemptId,
  onCompare,
  onSaved,
  onContinue,
}: Props) {
  const [storedState, setStoredState] = useState<{ attemptId: number; state: State }>({
    attemptId,
    state: { tag: 'waiting' },
  });
  const state =
    storedState.attemptId === attemptId ? storedState.state : { tag: 'waiting' as const };
  const generation = useRef(0);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  const compare = useCallback(
    async (retryTranscript: string) => {
      if (!isTauri()) {
        setStoredState({
          attemptId,
          state: { tag: 'error', message: 'Open the desktop app to compare this answer.' },
        });
        return;
      }
      const request = ++generation.current;
      setStoredState({ attemptId, state: { tag: 'loading' } });
      try {
        const result = await onCompare(retryTranscript);
        if (
          !isAttemptComparison(result) ||
          result.original_transcript !== original.trim() ||
          result.retry_transcript !== retryTranscript
        ) {
          throw new Error('Unexpected retry comparison response.');
        }
        if (request === generation.current) {
          onSaved(result);
          setStoredState({ attemptId, state: { tag: 'ready', result } });
        }
      } catch (cause) {
        if (request === generation.current)
          setStoredState({ attemptId, state: { tag: 'error', message: errorMessage(cause) } });
      }
    },
    [attemptId, onCompare, onSaved, original],
  );

  useEffect(() => {
    if (retry !== undefined && state.tag === 'waiting') void compare(retry);
  }, [compare, retry, state.tag]);

  return (
    <section aria-label="Compare your second attempt" className="talk-card">
      <div className="talk-card-label" data-tone="accent">
        Compare your second attempt
      </div>
      {state.tag === 'waiting' && (
        <p className="talk-help-text">
          Record and transcribe your answer to compare it with the original.
        </p>
      )}
      {state.tag === 'loading' && <p className="talk-help-text">Comparing the two transcripts…</p>}
      {state.tag === 'error' && (
        <TurnNotice message={state.message}>
          <Button
            onPress={() => (retry === undefined ? undefined : void compare(retry))}
            size="sm"
            variant="secondary"
          >
            Retry comparison
          </Button>
        </TurnNotice>
      )}
      {state.tag === 'ready' && (
        <RetryComparisonReady onContinue={onContinue} result={state.result} />
      )}
    </section>
  );
}
