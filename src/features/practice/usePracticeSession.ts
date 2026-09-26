import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { type AttemptComparison, type ConversationTurn, isProviderError } from '@/lib/types';
import {
  advancePractice,
  type PracticeState,
  recordRetryComparison,
  setTurnPending,
} from './lib/practiceState';
import {
  finishPracticeSession,
  getActivePracticeSession,
  startPracticeSession,
} from './sessionApi';

type Dependencies = {
  canChangeSession: boolean;
  resetCapture: () => void;
  playQuestion: (text: string) => void;
  stopSpeech: () => void;
};

function sessionError(cause: unknown, fallback: string): string {
  return isProviderError(cause) ? cause.message : fallback;
}

export function usePracticeSession(dependencies: Dependencies) {
  const [state, setState] = useState<PracticeState>(() =>
    isTauri() ? { tag: 'loading' } : { tag: 'idle' },
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isTauri()) return;
    let isCurrent = true;
    void getActivePracticeSession()
      .then((session) => {
        if (!isCurrent) return;
        setState(
          session
            ? {
                tag: 'active',
                sessionId: session.session_id,
                question: session.opening_question,
                turnCount: session.turn_count,
                targetTurns: session.target_turns,
                retryEvidence: session.retry_evidence,
              }
            : { tag: 'idle' },
        );
      })
      .catch((cause) => {
        if (!isCurrent) return;
        setState({ tag: 'idle' });
        setError(sessionError(cause, 'Could not restore the previous conversation. Please retry.'));
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  async function start() {
    if (state.tag !== 'idle' || !dependencies.canChangeSession) return;
    if (!isTauri()) {
      setError('Open the desktop app with bun run dev to start a conversation.');
      return;
    }
    setState({ tag: 'starting' });
    setError('');
    try {
      const session = await startPracticeSession();
      dependencies.stopSpeech();
      dependencies.resetCapture();
      setState({
        tag: 'active',
        sessionId: session.session_id,
        question: session.opening_question,
        turnCount: session.turn_count,
        targetTurns: session.target_turns,
        retryEvidence: session.retry_evidence,
      });
      dependencies.playQuestion(session.opening_question);
    } catch (cause) {
      setState({ tag: 'idle' });
      setError(sessionError(cause, 'Could not start practice. Please try again.'));
    }
  }

  async function finish() {
    if (state.tag !== 'active' || !dependencies.canChangeSession) return;
    const previous = state;
    setState({ ...previous, tag: 'finishing' });
    setError('');
    try {
      const summary = await finishPracticeSession(previous.sessionId);
      dependencies.stopSpeech();
      dependencies.resetCapture();
      setState({ tag: 'completed', summary });
    } catch (cause) {
      setState(previous);
      setError(sessionError(cause, 'Could not end practice. Please try again.'));
    }
  }

  const isBusy = state.tag === 'loading' || state.tag === 'starting' || state.tag === 'finishing';

  return {
    state,
    error,
    isBusy,
    start,
    finish,
    dismissSummary: () =>
      setState((current) => (current.tag === 'completed' ? { tag: 'idle' } : current)),
    acceptTurn: (sessionId: number, turn: ConversationTurn) =>
      setState((current) => advancePractice(current, sessionId, turn)),
    acceptRetryComparison: (sessionId: number, comparison: AttemptComparison) =>
      setState((current) => recordRetryComparison(current, sessionId, comparison)),
    onTurnPendingChange: (isPending: boolean) =>
      setState((current) => setTurnPending(current, isPending)),
  };
}
