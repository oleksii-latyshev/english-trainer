import { useEffect, useState } from 'react';
import type { DailyRecallPlan, SpokenRecallResult } from '@/lib/types';
import { getDailyRecallPlan, submitDailyRecall } from './sessionApi';

type RecallState =
  | { tag: 'loading' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; plan: DailyRecallPlan };

export function useDailyRecall(sessionId: number | undefined) {
  const [state, setState] = useState<RecallState>({ tag: 'loading' });
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [result, setResult] = useState<SpokenRecallResult | null>(null);

  useEffect(() => {
    if (sessionId === undefined) return;
    let current = true;
    void getDailyRecallPlan(sessionId)
      .then((plan) => {
        if (current) setState({ tag: 'ready', plan });
      })
      .catch(() => {
        if (current)
          setState({ tag: 'error', message: 'Could not load due phrases. Retry to continue.' });
      });
    return () => {
      current = false;
    };
  }, [sessionId]);

  async function reload() {
    if (sessionId === undefined) return;
    setState({ tag: 'loading' });
    try {
      setState({ tag: 'ready', plan: await getDailyRecallPlan(sessionId) });
    } catch {
      setState({ tag: 'error', message: 'Could not load due phrases. Retry to continue.' });
    }
  }

  async function submit(phraseId: number, transcript: string, resetCapture: () => void) {
    if (sessionId === undefined || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await submitDailyRecall(sessionId, phraseId, transcript);
      const plan = await getDailyRecallPlan(sessionId);
      setResult(saved);
      setState({ tag: 'ready', plan });
      resetCapture();
    } catch {
      setSaveError(
        'Could not confirm spoken recall. Keep your transcript and retry; saved attempts will not duplicate.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    state,
    active,
    saving,
    saveError,
    result,
    currentItem: state.tag === 'ready' ? state.plan.items[0] : undefined,
    start: () => {
      setResult(null);
      setActive(true);
    },
    leave: () => {
      setActive(false);
      setResult(null);
    },
    next: () => setResult(null),
    reload,
    submit,
  };
}
