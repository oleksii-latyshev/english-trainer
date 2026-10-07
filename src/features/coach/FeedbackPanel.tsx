import { toast } from '@heroui/react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { isProviderError, isTurnFeedback, type TurnFeedback } from '@/lib/types';
import { CoachingNote, type NoteState, type PhraseSaveState } from './CoachingNote';

type Props = {
  question: string;
  transcript: string;
  isCurrent: () => boolean;
  persistReviewed?: (transcript: string, feedback: TurnFeedback) => Promise<void>;
  initialFeedback?: TurnFeedback;
  isAnswerSent?: boolean;
  canReview?: boolean;
  sessionId?: number;
  sequence?: number;
  onSavePhrase?: (
    phrase: string,
    note: string,
    sessionId?: number,
    sequence?: number,
  ) => Promise<unknown>;
  onReviewed?: (feedback: TurnFeedback, question: string) => void;
  onTryAgain?: () => void;
  /** Called once a phrase from this feedback has been saved to Learning Memory. */
  onPhraseSaved?: () => void;
  onSpeakRewrite?: (text: string) => void;
};

const PHRASE_SAVED_MESSAGE = 'Saved to Memory — it’ll come back in a later session.';

function feedbackError(cause: unknown): string {
  if (isProviderError(cause)) return cause.message;
  return 'Could not review this answer. Please try again.';
}

async function loadFeedback(question: string, transcript: string): Promise<TurnFeedback> {
  if (!isTauri()) throw new Error('Open the desktop app to review your answer.');
  const result = await invoke<unknown>('get_turn_feedback', { question, transcript });
  if (!isTurnFeedback(result)) throw new Error('Unexpected coaching response');
  return result;
}

function isLatestReview(requestId: number, generation: number, isCurrent: () => boolean): boolean {
  return requestId === generation && isCurrent();
}

export function FeedbackPanel({
  question,
  transcript,
  isCurrent,
  persistReviewed,
  initialFeedback,
  isAnswerSent = true,
  canReview = true,
  sessionId,
  sequence,
  onSavePhrase,
  onReviewed,
  onTryAgain,
  onPhraseSaved,
  onSpeakRewrite,
}: Props) {
  const [answerQuestion] = useState(question);
  const [state, setState] = useState<NoteState>(
    initialFeedback ? { tag: 'ready', feedback: initialFeedback } : { tag: 'idle' },
  );
  const [persistError, setPersistError] = useState<string | null>(null);
  const [isFeedbackSaved, setIsFeedbackSaved] = useState(Boolean(initialFeedback));
  const [phraseSaveState, setPhraseSaveState] = useState<PhraseSaveState>('idle');
  const [phraseSaveError, setPhraseSaveError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  async function handlePersistence(result: TurnFeedback, requestId: number) {
    const isLatest = () => isLatestReview(requestId, generation.current, isCurrent);
    if (persistReviewed) {
      try {
        await persistReviewed(transcript, result);
        if (isLatest()) {
          setIsFeedbackSaved(true);
          onReviewed?.(result, answerQuestion);
        }
      } catch (cause) {
        setPersistError(feedbackError(cause));
      }
    } else if (isAnswerSent && sessionId === undefined) {
      setIsFeedbackSaved(true);
      onReviewed?.(result, answerQuestion);
    }
  }

  async function reviewAnswer() {
    if (state.tag === 'loading' || !isAnswerSent || !canReview) return;
    const requestId = ++generation.current;
    setState({ tag: 'loading' });
    setPersistError(null);
    setIsFeedbackSaved(false);

    try {
      const result = await loadFeedback(answerQuestion, transcript);
      if (!isLatestReview(requestId, generation.current, isCurrent)) return;
      setState({ tag: 'ready', feedback: result });
      await handlePersistence(result, requestId);
    } catch (cause) {
      if (isLatestReview(requestId, generation.current, isCurrent)) {
        setState({ tag: 'error', message: feedbackError(cause) });
      }
    }
  }

  async function retryPersist() {
    if (state.tag !== 'ready' || !persistReviewed) return;
    setPersistError(null);
    try {
      await persistReviewed(transcript, state.feedback);
      if (isCurrent()) {
        setIsFeedbackSaved(true);
        onReviewed?.(state.feedback, answerQuestion);
      }
    } catch (cause) {
      setPersistError(feedbackError(cause));
    }
  }

  async function handleSavePhrase() {
    if (state.tag !== 'ready' || phraseSaveState === 'saving' || !onSavePhrase) return;
    const focus = state.feedback.focus_feedback[0];
    const phrase = focus ? focus.improved : state.feedback.b2_rewrite;
    const note = focus ? focus.explanation : 'Stronger phrasing from conversation feedback';
    setPhraseSaveState('saving');
    setPhraseSaveError(null);
    try {
      await onSavePhrase(phrase, note, sessionId, sequence);
      setPhraseSaveState('saved');
      toast.success(PHRASE_SAVED_MESSAGE);
      onPhraseSaved?.();
    } catch {
      setPhraseSaveState('error');
      setPhraseSaveError('Could not save phrase to Learning Memory. Please retry.');
    }
  }

  return (
    <CoachingNote
      canReview={canReview}
      isAnswerSent={isAnswerSent}
      isFeedbackSaved={isFeedbackSaved}
      onRetryPersist={() => void retryPersist()}
      onReview={() => void reviewAnswer()}
      onSavePhrase={() => void handleSavePhrase()}
      onSpeakRewrite={onSpeakRewrite}
      onTryAgain={onTryAgain}
      persistError={persistError}
      phraseSaveError={phraseSaveError}
      phraseSaveState={phraseSaveState}
      state={state}
      transcript={transcript}
    />
  );
}
