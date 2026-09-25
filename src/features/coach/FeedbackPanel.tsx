import { Button, Card } from '@heroui/react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { isProviderError, isTurnFeedback, type TurnFeedback } from '@/lib/types';

type Props = {
  question: string;
  transcript: string;
  isCurrent: () => boolean;
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

export function FeedbackPanel({ question, transcript, isCurrent }: Props) {
  // Keep the question paired with this recording when the next conversation turn arrives.
  const [answerQuestion] = useState(question);
  const [state, setState] = useState<FeedbackState>({ tag: 'idle' });
  const generation = useRef(0);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  async function reviewAnswer() {
    if (state.tag === 'loading') return;
    if (!isTauri()) {
      setState({ tag: 'error', message: 'Open the desktop app to review your answer.' });
      return;
    }
    const requestId = ++generation.current;
    setState({ tag: 'loading' });
    try {
      const result = await invoke<unknown>('get_turn_feedback', {
        question: answerQuestion,
        transcript,
      });
      if (!isTurnFeedback(result)) throw new Error('Unexpected coaching response');
      if (requestId === generation.current && isCurrent()) {
        setState({ tag: 'ready', feedback: result });
      }
    } catch (cause) {
      if (requestId === generation.current && isCurrent()) {
        setState({ tag: 'error', message: feedbackError(cause) });
      }
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
          Review one useful improvement when you are ready. You can keep practising while the review
          runs.
        </p>
        <Button
          className="secondary-action"
          isDisabled={state.tag === 'loading'}
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
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
