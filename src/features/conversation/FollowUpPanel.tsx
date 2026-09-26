import { Button } from '@heroui/react';
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
  return invoke<unknown>('send_practice_turn', {
    sessionId,
    transcript,
  });
}

function panelKicker(surface: 'conversation' | 'coach'): string {
  if (surface === 'coach') return 'SAVED CONVERSATION TURN';
  return 'AI CONVERSATION';
}

function panelTitle(surface: 'conversation' | 'coach'): string {
  if (surface === 'coach') return 'Send turn for coach review';
  return 'Eva’s follow-up';
}

function emptyTranscriptMessage(surface: 'conversation' | 'coach'): string {
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
    <div className="prompt-card">
      <div className="prompt-card-header">
        <div>
          <p className="section-kicker">{panelKicker(surface)}</p>
          <h3 className="text-base font-semibold text-zinc-100">{panelTitle(surface)}</h3>
        </div>
        {state.tag === 'ready' && (
          <span className="flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
            <span>🌱</span> Eva replied
          </span>
        )}
      </div>

      <div>
        {state.tag === 'idle' && (
          <p className="transcript-empty">{emptyTranscriptMessage(surface)}</p>
        )}
        {state.tag === 'ready' && (
          <div aria-live="polite" className="followup-bubble">
            <p className="m-0 text-base leading-relaxed text-zinc-200">{state.turn.spoken_reply}</p>
            {state.turn.question && <p className="followup-question m-0">{state.turn.question}</p>}
          </div>
        )}
        {timing && (
          <div className="mt-4 border-t border-white/8 pt-3">
            <p className="section-kicker mb-2">RESPONSE TIMING</p>
            <dl className="timing-grid-codex" aria-label="Conversation response timing">
              <div className="timing-stat-box">
                <dt>agy CLI</dt>
                <dd>{formatTiming(timing.agyMs)}</dd>
              </div>
              <div className="timing-stat-box">
                <dt>AI request</dt>
                <dd>{formatTiming(timing.aiRequestMs)}</dd>
              </div>
              <div className="timing-stat-box">
                <dt>AI voice</dt>
                <dd>{formatTiming(timing.aiVoiceStartMs)}</dd>
              </div>
              <div className="timing-stat-box">
                <dt>Send → audio</dt>
                <dd>{formatTiming(timing.sendToAudioMs)}</dd>
              </div>
              <div className="timing-stat-box">
                <dt>Stop → audio</dt>
                <dd>{formatTiming(timing.stopToAudioMs)}</dd>
              </div>
            </dl>
          </div>
        )}
        {state.tag === 'error' && (
          <p className="error-message" role="alert">
            {state.message}
          </p>
        )}
        {isSessionReady ? (
          <p className="mt-4 mb-0 text-xs text-zinc-400">{readyContinuationMessage(surface)}</p>
        ) : (
          <div className="pt-2">
            <Button
              className="primary-action"
              isDisabled={state.tag === 'thinking'}
              onPress={onAskFollowUp}
            >
              {actionLabel(state, sessionId !== undefined, surface)}
            </Button>
          </div>
        )}
        <p className="mt-3 mb-0 text-xs leading-5 text-zinc-500">
          Audio stays local. This transcript is sent to the configured AI provider only when you
          ask.
        </p>
      </div>
    </div>
  );
}
