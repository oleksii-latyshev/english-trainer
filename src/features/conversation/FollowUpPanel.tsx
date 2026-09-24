import { Button, Card } from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import {
  type ConversationTurn,
  isConversationTurn,
  isProviderError,
  type ProviderErrorCode,
} from '@/lib/types';

type Props = {
  transcript: string;
  speak: (text: string) => void;
  isCurrent: () => boolean;
};

type FollowUpState =
  | { tag: 'idle' }
  | { tag: 'thinking' }
  | { tag: 'ready'; turn: ConversationTurn }
  | { tag: 'error'; code: ProviderErrorCode | 'unknown'; message: string };

function spokenTurn(turn: ConversationTurn): string {
  return turn.question ? `${turn.spoken_reply} ${turn.question}` : turn.spoken_reply;
}

function followUpError(cause: unknown): Extract<FollowUpState, { tag: 'error' }> {
  if (isProviderError(cause)) return { tag: 'error', code: cause.code, message: cause.message };
  return {
    tag: 'error',
    code: 'unknown',
    message: 'The AI follow-up could not be generated. Please try again.',
  };
}

function actionLabel(state: FollowUpState): string {
  switch (state.tag) {
    case 'thinking':
      return 'Thinking…';
    case 'ready':
      return 'Try another follow-up';
    case 'error':
      return state.code === 'unavailable' ? 'Retry after setup' : 'Retry follow-up';
    default:
      return 'Ask a follow-up';
  }
}

export function FollowUpPanel({ transcript, speak, isCurrent }: Props) {
  const [state, setState] = useState<FollowUpState>({ tag: 'idle' });
  const generation = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  async function askFollowUp() {
    if (pending.current) return;
    const requestId = ++generation.current;
    pending.current = true;
    setState({ tag: 'thinking' });
    try {
      const result = await invoke<unknown>('generate_follow_up', { transcript });
      if (!isConversationTurn(result)) throw new Error('Unexpected conversation response');
      if (requestId !== generation.current || !isCurrent()) return;
      setState({ tag: 'ready', turn: result });
      speak(spokenTurn(result));
    } catch (cause) {
      if (requestId === generation.current && isCurrent()) setState(followUpError(cause));
    } finally {
      pending.current = false;
    }
  }

  return (
    <Card className="panel mt-[18px]" variant="secondary">
      <Card.Header className="panel-header">
        <div>
          <p className="section-kicker">CONVERSATION PREVIEW</p>
          <Card.Title className="section-title">Keep the conversation going</Card.Title>
        </div>
      </Card.Header>
      <Card.Content className="panel-content">
        {state.tag === 'idle' && (
          <p className="empty-transcript">
            Ask Eva for one short reply and a question about what you said.
          </p>
        )}
        {state.tag === 'ready' && (
          <div aria-live="polite" className="grid gap-3 text-[0.96rem] leading-7 text-slate-100">
            <p className="m-0">{state.turn.spoken_reply}</p>
            {state.turn.question && (
              <p className="m-0 font-semibold text-teal-200">{state.turn.question}</p>
            )}
          </div>
        )}
        {state.tag === 'error' && (
          <p className="error-message" role="alert">
            {state.message}
          </p>
        )}
        <Button
          className="secondary-action mt-5 self-start"
          isDisabled={state.tag === 'thinking'}
          onPress={askFollowUp}
          variant="secondary"
        >
          {actionLabel(state)}
        </Button>
        <p className="mt-3 mb-0 text-xs leading-5 text-slate-400">
          Audio stays local. This transcript is sent to the configured AI provider only when you
          ask.
        </p>
      </Card.Content>
    </Card>
  );
}
