import { Button, Card } from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { formatTiming } from '@/lib/formatTiming';
import {
  type ConversationTurn,
  isConversationTurn,
  isProviderError,
  type ProviderErrorCode,
} from '@/lib/types';
import { turnTiming } from './lib/turnTiming';

type Props = {
  transcript: string;
  speak: (text: string, onStart?: (latencyMs: number) => void) => void;
  isCurrent: () => boolean;
  speechStoppedAtMs?: number;
  sessionId?: number;
  onTurn?: (turn: ConversationTurn) => void;
  onPendingChange?: (isPending: boolean) => void;
};

type FollowUpState =
  | { tag: 'idle' }
  | { tag: 'thinking' }
  | {
      tag: 'ready';
      turn: ConversationTurn;
      sentAtMs: number;
      replyAtMs: number;
      audioAtMs?: number;
      voiceStartMs?: number;
    }
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

function actionLabel(state: FollowUpState, isSession: boolean): string {
  switch (state.tag) {
    case 'thinking':
      return 'Thinking…';
    case 'ready':
      return 'Try another follow-up';
    case 'error':
      return state.code === 'unavailable' ? 'Retry after setup' : 'Retry follow-up';
    default:
      return isSession ? 'Send answer to Eva' : 'Ask a follow-up';
  }
}

function requestTurn(sessionId: number | undefined, transcript: string): Promise<unknown> {
  if (sessionId === undefined) return invoke<unknown>('generate_follow_up', { transcript });
  return invoke<unknown>('send_practice_turn', { sessionId, transcript });
}

export function FollowUpPanel({
  transcript,
  speak,
  isCurrent,
  sessionId,
  onTurn,
  onPendingChange,
  speechStoppedAtMs,
}: Props) {
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
    onPendingChange?.(true);
    setState({ tag: 'thinking' });
    const sentAtMs = performance.now();
    try {
      const result = await requestTurn(sessionId, transcript);
      const replyAtMs = performance.now();
      if (!isConversationTurn(result)) throw new Error('Unexpected conversation response');
      if (requestId !== generation.current || !isCurrent()) return;
      setState({ tag: 'ready', turn: result, sentAtMs, replyAtMs });
      onTurn?.(result);
      speak(spokenTurn(result), (voiceStartMs) => {
        if (requestId !== generation.current || !isCurrent()) return;
        const audioAtMs = performance.now();
        setState((current) =>
          current.tag === 'ready' ? { ...current, audioAtMs, voiceStartMs } : current,
        );
      });
    } catch (cause) {
      if (requestId === generation.current && isCurrent()) setState(followUpError(cause));
    } finally {
      pending.current = false;
      onPendingChange?.(false);
    }
  }

  const timing =
    state.tag === 'ready'
      ? turnTiming({
          sentAtMs: state.sentAtMs,
          replyAtMs: state.replyAtMs,
          audioAtMs: state.audioAtMs,
          voiceStartMs: state.voiceStartMs,
          speechStoppedAtMs,
          providerLatencyMs: state.turn.provider_latency_ms,
        })
      : undefined;

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
            {sessionId === undefined
              ? 'Ask Eva for one short reply and a question about what you said.'
              : 'Send your answer to Eva to continue the conversation.'}
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
        {timing && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="section-kicker mb-3">RESPONSE TIMING</p>
            <dl className="timing-grid" aria-label="Conversation response timing">
              <div>
                <dt>agy</dt>
                <dd>{formatTiming(timing.agyMs)}</dd>
              </div>
              <div>
                <dt>AI request</dt>
                <dd>{formatTiming(timing.aiRequestMs)}</dd>
              </div>
              <div>
                <dt>AI voice start</dt>
                <dd>{formatTiming(timing.aiVoiceStartMs)}</dd>
              </div>
              <div>
                <dt>Send → audio</dt>
                <dd>{formatTiming(timing.sendToAudioMs)}</dd>
              </div>
              <div>
                <dt>Stop → audio</dt>
                <dd>{formatTiming(timing.stopToAudioMs)}</dd>
              </div>
            </dl>
            <p className="timing-note">
              AI request includes agy, IPC, and local saving. Stop → audio also includes the time
              you spent reviewing and sending your answer.
            </p>
          </div>
        )}
        {state.tag === 'error' && (
          <p className="error-message" role="alert">
            {state.message}
          </p>
        )}
        {sessionId !== undefined && state.tag === 'ready' ? (
          <p className="mt-4 mb-0 text-sm text-slate-300">
            Record an answer to Eva’s new question to continue.
          </p>
        ) : (
          <Button
            className="secondary-action mt-5 self-start"
            isDisabled={state.tag === 'thinking'}
            onPress={askFollowUp}
            variant="secondary"
          >
            {actionLabel(state, sessionId !== undefined)}
          </Button>
        )}
        <p className="mt-3 mb-0 text-xs leading-5 text-slate-400">
          Audio stays local. This transcript is sent to the configured AI provider only when you
          ask.
        </p>
      </Card.Content>
    </Card>
  );
}
