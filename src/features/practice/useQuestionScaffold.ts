import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { isQuestionScaffold, type QuestionScaffold } from '@/lib/types';

type HintState =
  | { tag: 'loading' }
  | { tag: 'ready'; question: string; hints: QuestionScaffold }
  | { tag: 'error'; question: string };

/** Prepares phrase help for the question in the background so the help bar opens instantly. */
export function useQuestionScaffold(question: string) {
  const [hintState, setHintState] = useState<HintState>({ tag: 'loading' });
  const [retryCount, setRetryCount] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount intentionally reissues help for the same question.
  useEffect(() => {
    if (!isTauri()) return;
    let isCurrent = true;
    void invoke<unknown>('get_question_scaffold', { question })
      .then((result) => {
        if (!isCurrent) return;
        setHintState(
          isQuestionScaffold(result)
            ? { tag: 'ready', question, hints: result }
            : { tag: 'error', question },
        );
      })
      .catch(() => {
        if (isCurrent) setHintState({ tag: 'error', question });
      });
    return () => {
      isCurrent = false;
    };
  }, [question, retryCount]);

  return {
    hints: hintState.tag === 'ready' && hintState.question === question ? hintState.hints : null,
    hasError: hintState.tag === 'error' && hintState.question === question,
    retry: () => {
      setHintState({ tag: 'loading' });
      setRetryCount((current) => current + 1);
    },
  };
}
