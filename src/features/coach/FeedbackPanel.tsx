import { Button, Card } from '@heroui/react';
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
  // Keep the question paired with this recording when the next conversation turn arrives.
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

  async function reviewAnswer() {
    if (state.tag === 'loading') return;
    const requestId = ++generation.current;
    setState({ tag: 'loading' });
    setPersistError(null);
    setIsFeedbackSaved(false);

    let result: TurnFeedback;
    try {
      result = await loadFeedback(answerQuestion, transcript);
    } catch (cause) {
      if (isLatestReview(requestId, generation.current, isCurrent)) {
        setState({ tag: 'error', message: feedbackError(cause) });
      }
      return;
    }

    if (!isLatestReview(requestId, generation.current, isCurrent)) return;
    setState({ tag: 'ready', feedback: result });

    if (persistReviewed) {
      try {
        await persistReviewed(transcript, result);
        setPersistError(null);
        if (isLatestReview(requestId, generation.current, isCurrent)) {
          setIsFeedbackSaved(true);
          onReviewed?.(result, answerQuestion);
        }
      } catch (cause) {
        // Memory write failure isolation: feedback is kept usable, error offered with retry
        setPersistError(feedbackError(cause));
      }
    } else {
      setIsFeedbackSaved(true);
      onReviewed?.(result, answerQuestion);
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

  const focus = state.tag === 'ready' ? state.feedback.focus_feedback[0] : undefined;

  return (
    <Card className="panel mt-[18px]" variant="secondary">
      <Card.Header className="panel-header">
        <div>
          <p className="section-kicker">OPTIONAL COACHING</p>
          <Card.Title className="section-title">Make this answer stronger</Card.Title>
        </div>
      </Card.Header>
      <Card.Content className="panel-content">
        <p className="mt-0 text-sm leading-6 text-slate-400">
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
          variant="secondary"
        >
          {reviewButtonLabel(state)}
        </Button>
        {state.tag === 'error' && (
          <p className="error-message" role="alert">
            {state.message}
          </p>
        )}
        {state.tag === 'ready' && (
          <div aria-live="polite" className="mt-5 grid gap-4 border-t border-white/10 pt-4">
            {focus ? (
              <div>
                <p className="section-kicker">
                  ONE THING TO IMPROVE · {focus.category.toUpperCase()}
                </p>
                <p className="m-0 text-sm text-slate-300">You said: {focus.original}</p>
                <p className="mt-2 mb-0 text-base font-semibold text-teal-100">
                  Try: {focus.improved}
                </p>
                <p className="mt-2 mb-0 text-sm leading-6 text-slate-400">{focus.explanation}</p>
              </div>
            ) : (
              <p className="m-0 text-sm text-slate-300">
                No priority correction was found for this answer.
              </p>
            )}
            <div>
              <p className="section-kicker">A STRONGER VERSION</p>
              <blockquote className="m-0 border-l-2 border-teal-400/70 pl-4 text-base leading-7 text-slate-100">
                {state.feedback.b2_rewrite}
              </blockquote>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {onTryAgain && isFeedbackSaved && (
                <Button className="primary-action w-fit" onPress={onTryAgain} variant="primary">
                  Try Again
                </Button>
              )}
              <Button
                className="secondary-action w-fit"
                isDisabled={phraseSaveState === 'saving' || !onSavePhrase}
                onPress={() => void handleSavePhrase()}
                variant="secondary"
              >
                {phraseSaveState === 'saving'
                  ? 'Saving phrase…'
                  : phraseSaveState === 'saved'
                    ? 'Phrase saved ✓'
                    : phraseSaveState === 'error'
                      ? 'Retry saving phrase'
                      : 'Save phrase'}
              </Button>
            </div>

            {phraseSaveError && (
              <p className="error-message text-xs" role="alert">
                {phraseSaveError}
              </p>
            )}

            {persistError && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded border border-amber-500/30 bg-amber-950/20 p-2.5 text-xs text-amber-200">
                <span>Could not save feedback to memory: {persistError}</span>
                <Button
                  className="secondary-action text-xs"
                  onPress={() => void retryPersist()}
                  variant="secondary"
                >
                  Retry save
                </Button>
              </div>
            )}
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
