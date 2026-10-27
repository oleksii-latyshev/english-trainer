import type { MicrophoneStatus } from '@/core/audio';
import type { TranscriptionRecovery } from '@/core/speech';

export type TurnFix =
  | 'retry-send'
  | 'switch-to-apple'
  | 'transcribe-again'
  | 'record-again'
  | 'open-settings'
  | 'choose-microphone'
  | 'resume-mic';

export type TurnIssue = {
  message: string;
  kind: 'reply' | 'transcription' | 'microphone';
  fixes: TurnFix[];
};

type SendFailure = { message: string; needsSetup: boolean; isUnresponsive: boolean };

export type IssueSignals = {
  sendError?: SendFailure;
  canSwitchToApple: boolean;
  transcriptionFailure?: TranscriptionRecovery;
  captureError: string;
  micStatus: MicrophoneStatus | 'unmanaged';
  micError: string;
};

function transcriptionFix(failure: TranscriptionRecovery): TurnFix {
  switch (failure.kind) {
    case 'setup':
      return 'open-settings';
    case 'record_again':
      return 'record-again';
    case 'retry':
      return 'transcribe-again';
  }
}

function replyFixes(sendError: SendFailure, canSwitchToApple: boolean): TurnFix[] {
  if (sendError.needsSetup) return ['open-settings'];
  if (sendError.isUnresponsive && canSwitchToApple) return ['switch-to-apple', 'retry-send'];
  return ['retry-send'];
}

export function turnIssue(signals: IssueSignals): TurnIssue | null {
  const { sendError, transcriptionFailure } = signals;
  if (sendError) {
    return {
      message: sendError.message,
      kind: 'reply',
      fixes: replyFixes(sendError, signals.canSwitchToApple),
    };
  }
  if (transcriptionFailure) {
    return {
      message: transcriptionFailure.message,
      kind: 'transcription',
      fixes: [transcriptionFix(transcriptionFailure)],
    };
  }
  if (signals.captureError) {
    return {
      message: signals.captureError,
      kind: 'microphone',
      fixes: ['choose-microphone', 'record-again'],
    };
  }
  if (signals.micStatus === 'error') {
    return {
      message: signals.micError || 'The microphone is unavailable.',
      kind: 'microphone',
      fixes: ['choose-microphone', 'resume-mic'],
    };
  }
  return null;
}

export const FIX_LABEL: Record<TurnFix, string> = {
  'retry-send': 'Retry',
  'switch-to-apple': 'Switch to Apple on-device',
  'transcribe-again': 'Retry',
  'record-again': 'Record again',
  'open-settings': 'Open Settings',
  'choose-microphone': 'Choose microphone',
  'resume-mic': 'Resume mic',
};
