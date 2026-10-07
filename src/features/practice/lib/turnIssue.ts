import type { MicrophoneStatus } from '@/audio/microphoneManager';
import type { TranscriptionRecovery } from '@/features/speech/transcriptionRecovery';

/** What fixes a problem in one press; the screen maps each to an existing action. */
export type TurnFix =
  | 'retry-send'
  | 'switch-to-apple'
  | 'transcribe-again'
  | 'record-again'
  | 'open-settings'
  | 'choose-microphone'
  | 'resume-mic';

/** `fixes` are in display order: the first is the main one, any others are quieter alternatives. */
export type TurnIssue = {
  message: string;
  kind: 'reply' | 'transcription' | 'microphone';
  fixes: TurnFix[];
};

/**
 * The answer could not be sent. `needsSetup` when no retry can help until Settings change;
 * `isUnresponsive` when the model did not answer, so another model may.
 */
export type SendFailure = { message: string; needsSetup: boolean; isUnresponsive: boolean };

export type IssueSignals = {
  sendError?: SendFailure;
  /** The conversation model can be switched to Apple on-device (it is not already that one). */
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

/** One sentence and the fixes that can help; the most recent cause the learner can still act on wins. */
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
