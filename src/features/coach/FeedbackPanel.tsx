import { Button } from '@heroui/react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { isProviderError, isTurnFeedback, type TurnFeedback } from '@/lib/types';

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
};

type FeedbackState =
  | { tag: 'idle' }
  | { tag: 'loading' }
  | { tag: 'ready'; feedback: TurnFeedback }
  | { tag: 'error'; message: string };

function feedbackError(cause: unknown): string {
  if (isProviderError(cause)) return cause.message;
  return 'Could not review this answer. Please try again.';
}

function reviewButtonLabel(state: FeedbackState): string {
  switch (state.tag) {
    case 'loading':
      return 'Reviewing…';
    case 'ready':
      return 'Review again';
    case 'error':
      return 'Retry review';
    default:
      return 'Review my answer';
  }
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

function FeedbackReadyContent({
  feedback,
  onTryAgain,
  isFeedbackSaved,
  phraseSaveState,
  onSavePhrase,
  phraseSaveError,
  persistError,
  onRetryPersist,
}: {
  feedback: TurnFeedback;
  onTryAgain?: () => void;
  isFeedbackSaved: boolean;
  phraseSaveState: 'idle' | 'saving' | 'saved' | 'error';
  onSavePhrase: () => void;
  phraseSaveError: string | null;
  persistError: string | null;
  onRetryPersist: () => void;
}) {
  const focus = feedback.focus_feedback[0];
  return (
    <div aria-live="polite" className="mt-4 flex flex-col gap-4 border-t border-white/8 pt-4">
      {focus ? (
        <div className="feedback-highlight-box">
          <div className="flex items-center justify-between">
            <p className="section-kicker !text-emerald-400">PRIORITY CORRECTION</p>
            <span className="feedback-category-badge">{focus.category}</span>
          </div>
          <p className="feedback-original-text">
            <span className="text-zinc-500 line-through">You said:</span> “{focus.original}”
          </p>
          <p className="feedback-improved-text">
            <span className="text-emerald-400">Try:</span> “{focus.improved}”
          </p>
          <p className="feedback-explanation">{focus.explanation}</p>
        </div>
      ) : (
        <p className="m-0 text-sm text-zinc-400">
          No priority correction was found for this answer.
        </p>
      )}

      <div className="b2-rewrite-card">
        <p className="section-kicker !text-purple-300">A STRONGER B2 VERSION</p>
        <blockquote className="b2-quote">“{feedback.b2_rewrite}”</blockquote>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        {onTryAgain && isFeedbackSaved && (
          <Button className="primary-action" onPress={onTryAgain}>
            Try Again ▶
          </Button>
        )}
        <Button
          className="secondary-action"
          isDisabled={phraseSaveState === 'saving'}
          onPress={onSavePhrase}
        >
          {phraseSaveState === 'saving'
            ? 'Saving phrase…'
            : phraseSaveState === 'saved'
              ? 'Phrase saved ✓'
              : phraseSaveState === 'error'
                ? 'Retry saving phrase'
                : 'Save phrase to Learning Memory +'}
        </Button>
      </div>

      {phraseSaveError && (
        <p className="error-message text-xs" role="alert">
          {phraseSaveError}
        </p>
      )}

      {persistError && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
          <span>Could not save feedback to memory: {persistError}</span>
          <Button className="secondary-action text-xs" onPress={onRetryPersist}>
            Retry save
          </Button>
        </div>
      )}
    </div>
  );
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
}: Props) {
  const [answerQuestion] = useState(question);
  const [state, setState] = useState<FeedbackState>(
    initialFeedback ? { tag: 'ready', feedback: initialFeedback } : { tag: 'idle' },
  );
  const [persistError, setPersistError] = useState<string | null>(null);
  const [isFeedbackSaved, setIsFeedbackSaved] = useState(Boolean(initialFeedback));
  const [phraseSaveState, setPhraseSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
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
    } catch {
      setPhraseSaveState('error');
      setPhraseSaveError('Could not save phrase to Learning Memory. Please retry.');
    }
  }

  return (
    <div className="coach-card">
      <div className="prompt-card-header">
        <div>
          <p className="section-kicker">OPTIONAL COACHING</p>
          <h3 className="text-base font-semibold text-zinc-100">Make this answer stronger</h3>
        </div>
      </div>
      <div>
        <p className="mt-0 mb-3 text-sm leading-6 text-zinc-400">
          {!canReview
            ? 'The first answer and its feedback stay anchored while you record the retry.'
            : isAnswerSent
              ? 'Review one useful improvement when you are ready. You can keep practising while the review runs.'
              : 'Send this answer to Eva first. Then the review and Try Again will stay linked to this saved turn.'}
        </p>
        <Button
          className="secondary-action"
          isDisabled={state.tag === 'loading' || !isAnswerSent || !canReview}
          onPress={() => void reviewAnswer()}
        >
          {reviewButtonLabel(state)}
        </Button>
        {state.tag === 'error' && (
          <p className="error-message mt-3" role="alert">
            {state.message}
          </p>
        )}
        {state.tag === 'ready' && (
          <FeedbackReadyContent
            feedback={state.feedback}
            isFeedbackSaved={isFeedbackSaved}
            onRetryPersist={() => void retryPersist()}
            onSavePhrase={() => void handleSavePhrase()}
            onTryAgain={onTryAgain}
            persistError={persistError}
            phraseSaveError={phraseSaveError}
            phraseSaveState={phraseSaveState}
          />
        )}
      </div>
    </div>
  );
}
