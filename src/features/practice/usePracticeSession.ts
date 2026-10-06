import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import {
  type AttemptComparison,
  type ConversationTurn,
  isProviderError,
  type SessionMode,
  type TurnFeedback,
} from '@/lib/types';
import type { InputSource } from './lib/inputSource';
import {
  advanceCoachTurn,
  advancePractice,
  type PracticeState,
  recordCoachAnswer,
  recordRetryComparison,
  setTurnPending,
  updateCoachFeedback,
} from './lib/practiceState';
import {
  continueCoachTurn,
  finishPracticeSession,
  getActivePracticeSession,
  saveCoachAnswer,
  savePracticeFeedback,
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
                mode: session.mode ?? 'conversation',
                question: session.opening_question,
                turnCount: session.turn_count,
                targetTurns: session.target_turns,
                retryEvidence: session.retry_evidence,
                coachState: session.coach_state,
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

  async function start(mode: SessionMode = 'conversation') {
    if (state.tag !== 'idle' || !dependencies.canChangeSession) return;
    if (!isTauri()) {
      setError('Open the desktop app with bun run dev to start a conversation.');
      return;
    }
    setState({ tag: 'starting' });
    setError('');
    try {
      const session = await startPracticeSession(mode);
      dependencies.stopSpeech();
      dependencies.resetCapture();
      setState({
        tag: 'active',
        sessionId: session.session_id,
        mode: session.mode ?? mode,
        question: session.opening_question,
        turnCount: session.turn_count,
        targetTurns: session.target_turns,
        retryEvidence: session.retry_evidence,
        coachState: session.coach_state,
      });
      if (!session.coach_state?.is_pending) dependencies.playQuestion(session.opening_question);
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
    acceptTurn: (sessionId: number, transcript: string, turn: ConversationTurn) =>
      setState((current) => advancePractice(current, sessionId, transcript, turn)),
    saveCoachAnswer: async (sessionId: number, transcript: string, inputSource?: InputSource) => {
      setState((current) => setTurnPending(current, true));
      try {
        const saved = await saveCoachAnswer(sessionId, transcript, inputSource);
        setState((current) => recordCoachAnswer(current, sessionId, saved));
        return saved;
      } catch (cause) {
        setState((current) => setTurnPending(current, false));
        throw cause;
      }
    },
    continueCoachTurn: async (
      sessionId: number,
      sequence: number,
      onDelta?: (text: string) => void,
    ) => {
      setState((current) => setTurnPending(current, true));
      try {
        const turn = await continueCoachTurn(sessionId, sequence, onDelta);
        setState((current) => advanceCoachTurn(current, sessionId, turn));
        dependencies.resetCapture();
        dependencies.playQuestion(turn.question ?? turn.spoken_reply);
        return turn;
      } catch (cause) {
        setState((current) => setTurnPending(current, false));
        throw cause;
      }
    },
    saveFeedback: async (
      sessionId: number,
      sequence: number,
      transcript: string,
      feedback: TurnFeedback,
    ) => {
      await savePracticeFeedback(sessionId, sequence, transcript, feedback);
      setState((current) => updateCoachFeedback(current, sessionId, sequence, feedback));
    },
    acceptRetryComparison: (sessionId: number, comparison: AttemptComparison) =>
      setState((current) => recordRetryComparison(current, sessionId, comparison)),
    onTurnPendingChange: (isPending: boolean) =>
      setState((current) => setTurnPending(current, isPending)),
  };
}
