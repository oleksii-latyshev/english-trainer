import { Button, Card } from '@heroui/react';
import { isTauri } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    <Card className="panel mt-[18px]" variant="secondary">
      <Card.Header className="panel-header">
        <div>
          <p className="section-kicker">TRY AGAIN</p>
          <Card.Title className="section-title">Compare your second attempt</Card.Title>
        </div>
      </Card.Header>
      <Card.Content className="panel-content">
        {state.tag === 'waiting' && (
          <p className="empty-transcript">
            Record and transcribe your answer to compare it with the original.
          </p>
        )}
        {state.tag === 'loading' && (
          <p className="empty-transcript">Comparing the two transcripts…</p>
        )}
        {state.tag === 'error' && (
          <div className="grid justify-items-start gap-3">
            <p className="error-message" role="alert">
              {state.message}
            </p>
            <Button
              className="secondary-action"
              onPress={() => (retry === undefined ? undefined : void compare(retry))}
              variant="secondary"
            >
              Retry comparison
            </Button>
          </div>
        )}
        {state.tag === 'ready' && (
          <div aria-live="polite" className="grid gap-4">
            <div>
              <p className="section-kicker">FIRST ATTEMPT</p>
              <p className="transcript-text">{state.result.original_transcript}</p>
            </div>
            <div>
              <p className="section-kicker">TRY AGAIN</p>
              <p className="transcript-text">{state.result.retry_transcript}</p>
            </div>
            <p className="m-0 text-sm text-slate-300">
              Target wording evidence: {state.result.target_evidence.replace(/_/g, ' ')} · Word
              count change: {state.result.word_count_change > 0 ? '+' : ''}
              {state.result.word_count_change}
            </p>
            {state.result.target.length === 0 && (
              <p className="m-0 text-xs text-slate-400">
                No focused correction was available for a target wording comparison.
              </p>
            )}
            <p className="m-0 text-xs text-slate-400">Hesitation: {state.result.hesitation}</p>
            <Button className="secondary-action w-fit" onPress={onContinue} variant="secondary">
              Continue with a new answer
            </Button>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
