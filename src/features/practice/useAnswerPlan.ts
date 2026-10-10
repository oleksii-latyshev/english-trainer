import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { type AnswerPlan, isAnswerPlan } from '@/lib/answerPlanTypes';
import { isProviderError } from '@/lib/types';

type PlanState =
  | { tag: 'loading'; identity: string }
  | { tag: 'ready'; identity: string; plan: AnswerPlan }
  | { tag: 'error'; identity: string; message: string };

function errorMessage(cause: unknown): string {
  return isProviderError(cause)
    ? cause.message
    : 'Answer help is unavailable. You can keep speaking or retry.';
}

export function useAnswerPlan(
  sessionId: number | undefined,
  sequence: number | undefined,
  question: string,
) {
  const identity = `${sessionId ?? ''}:${sequence ?? ''}:${question}`;
  const [state, setState] = useState<PlanState>({ tag: 'loading', identity });
  const generation = useRef(0);

  useEffect(() => {
    if (!sessionId || !sequence || !question || !isTauri()) return;
    const request = ++generation.current;
    let isCurrent = true;
    setState({ tag: 'loading', identity });
    void invoke<unknown>('prefetch_answer_plan', {
      session_id: sessionId,
      sequence,
      question,
      retry: false,
    })
      .then((result) => {
        if (!isCurrent || generation.current !== request) return;
        setState(
          isAnswerPlan(result)
            ? { tag: 'ready', identity, plan: result }
            : {
                tag: 'error',
                identity,
                message: 'Answer help could not be checked. Please retry.',
              },
        );
      })
      .catch((cause: unknown) => {
        if (isCurrent && generation.current === request) {
          setState({ tag: 'error', identity, message: errorMessage(cause) });
        }
      });
    return () => {
      isCurrent = false;
      generation.current += 1;
    };
  }, [identity, question, sequence, sessionId]);

  async function retry() {
    if (!sessionId || !sequence || !question || !isTauri()) return;
    const request = ++generation.current;
    setState({ tag: 'loading', identity });
    try {
      const result: unknown = await invoke<unknown>('prefetch_answer_plan', {
        session_id: sessionId,
        sequence,
        question,
        retry: true,
      });
      if (generation.current !== request) return;
      setState(
        isAnswerPlan(result)
          ? { tag: 'ready', identity, plan: result }
          : { tag: 'error', identity, message: 'Answer help could not be checked. Please retry.' },
      );
    } catch (cause: unknown) {
      if (generation.current === request) {
        setState({ tag: 'error', identity, message: errorMessage(cause) });
      }
    }
  }

  const current = state.identity === identity ? state : null;
  return {
    plan: current?.tag === 'ready' ? current.plan : null,
    isLoading: current === null || current.tag === 'loading',
    hasError: current?.tag === 'error',
    errorMessage: current?.tag === 'error' ? current.message : null,
    retry,
  };
}
