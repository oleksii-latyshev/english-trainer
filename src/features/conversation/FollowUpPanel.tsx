import { Button, Card } from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import { formatTiming } from '@/lib/formatTiming';
import { type ConversationTurn, isProviderError, type ProviderErrorCode } from '@/lib/types';
import { turnTiming } from './lib/turnTiming';

export type FollowUpState =
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

type Props = {
  speechStoppedAtMs?: number;
  sessionId?: number;
  surface?: 'conversation' | 'coach';
  state: FollowUpState;
  onAskFollowUp: () => void;
};

export function spokenTurn(turn: ConversationTurn): string {
  return turn.question ? `${turn.spoken_reply} ${turn.question}` : turn.spoken_reply;
}

export function followUpError(cause: unknown): Extract<FollowUpState, { tag: 'error' }> {
  if (isProviderError(cause)) return { tag: 'error', code: cause.code, message: cause.message };
  return {
    tag: 'error',
    code: 'unknown',
    message: 'The AI follow-up could not be generated. Please try again.',
  };
}

export function actionLabel(
  state: FollowUpState,
  isSession: boolean,
  surface: 'conversation' | 'coach' = 'conversation',
): string {
  switch (state.tag) {
    case 'thinking':
      return 'Thinking…';
    case 'ready':
      return 'Try another follow-up';
    case 'error':
      if (state.code === 'unavailable') return 'Retry after setup';
      return surface === 'coach' ? 'Retry send' : 'Retry follow-up';
    default:
      return isSession ? 'Send answer to Eva' : 'Ask a follow-up';
  }
}

export function requestTurn(sessionId: number | undefined, transcript: string): Promise<unknown> {
  if (sessionId === undefined) return invoke<unknown>('generate_follow_up', { transcript });
  return invoke<unknown>('send_practice_turn', { sessionId, transcript });
}

function panelKicker(surface: 'conversation' | 'coach'): string {
  return surface === 'coach' ? 'COACH MODE' : 'CONVERSATION PREVIEW';
}

function panelTitle(surface: 'conversation' | 'coach'): string {
  return surface === 'coach' ? 'Save answer to Eva' : 'Keep the conversation going';
}

function emptyTranscriptMessage(
  sessionId: number | undefined,
  surface: 'conversation' | 'coach',
): string {
  if (sessionId === undefined) {
    return 'Ask Eva for one short reply and a question about what you said.';
  }
  if (surface === 'coach') {
    return 'Send your answer to Eva to save this turn and unlock focused feedback.';
  }
  return 'Send your answer to Eva to continue the conversation.';
}

function readyContinuationMessage(surface: 'conversation' | 'coach'): string {
  if (surface === 'coach') {
    return 'Answer saved. Review focused feedback below, or record an answer to Eva’s new question.';
  }
  return 'Record an answer to Eva’s new question to continue.';
}

export function FollowUpPanel({
  sessionId,
  speechStoppedAtMs,
  surface = 'conversation',
  state,
  onAskFollowUp,
}: Props) {
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

  const isSessionReady = sessionId !== undefined && state.tag === 'ready';

  return (
    <Card className="panel mt-[18px]" variant="secondary">
      <Card.Header className="panel-header">
        <div>
          <p className="section-kicker">{panelKicker(surface)}</p>
          <Card.Title className="section-title">{panelTitle(surface)}</Card.Title>
        </div>
      </Card.Header>
      <Card.Content className="panel-content">
        {state.tag === 'idle' && (
          <p className="empty-transcript">{emptyTranscriptMessage(sessionId, surface)}</p>
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
        {isSessionReady ? (
          <p className="mt-4 mb-0 text-sm text-slate-300">{readyContinuationMessage(surface)}</p>
        ) : (
          <Button
            className="secondary-action mt-5 self-start"
            isDisabled={state.tag === 'thinking'}
            onPress={onAskFollowUp}
            variant="secondary"
          >
            {actionLabel(state, sessionId !== undefined, surface)}
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
