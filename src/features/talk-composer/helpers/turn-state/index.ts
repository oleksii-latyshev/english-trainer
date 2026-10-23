import type { RecordingMode } from '@/core/answer-capture';
import type { MicrophoneStatus } from '@/core/audio';
import type { EvaMood } from '@/shared/ui/eva';
import type { TurnFix, TurnIssue } from '../turn-issue';

export type CaptureStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

export type TurnState =
  | { tag: 'idle' }
  | { tag: 'listening' | 'auto-listen'; isLive: boolean; isHeld: boolean }
  | { tag: 'transcribing' }
  | { tag: 'review'; sendingLabel?: string }
  | { tag: 'thinking' }
  | { tag: 'speaking' }
  | { tag: 'paused' }
  | { tag: 'error'; issue: TurnIssue };

export type TurnSignals = {
  micStatus: MicrophoneStatus | 'unmanaged';
  captureStatus: CaptureStatus;
  recordingMode?: RecordingMode;
  isHeld: boolean;
  isTranscribing: boolean;
  hasTranscript: boolean;
  sendingLabel?: string;
  isThinking: boolean;
  isEvaSpeaking: boolean;
  issue: TurnIssue | null;
};

export function canPressMic(state: TurnState, isUnavailable: boolean): boolean {
  switch (state.tag) {
    case 'listening':
    case 'auto-listen':
      return state.isLive;
    case 'transcribing':
      return false;
    case 'thinking':
      return !isUnavailable;
    case 'paused':
      return true;
    default:
      return !isUnavailable;
  }
}

function isListening(status: CaptureStatus): boolean {
  return status === 'requesting' || status === 'recording' || status === 'stopping';
}

export function deriveTurnState(signals: TurnSignals): TurnState {
  if (signals.micStatus === 'paused') return { tag: 'paused' };
  if (isListening(signals.captureStatus)) {
    return {
      tag: signals.recordingMode === 'auto' ? 'auto-listen' : 'listening',
      isLive: signals.captureStatus === 'recording',
      isHeld: signals.isHeld,
    };
  }
  if (signals.isTranscribing) return { tag: 'transcribing' };
  if (signals.isEvaSpeaking) return { tag: 'speaking' };
  if (signals.isThinking) return { tag: 'thinking' };
  if (signals.issue) return { tag: 'error', issue: signals.issue };
  if (signals.hasTranscript) return { tag: 'review', sendingLabel: signals.sendingLabel };
  return { tag: 'idle' };
}

export type TurnPresentation = {
  mood: EvaMood;
  actor: 'learner' | 'eva' | 'neutral';
  stageLabel: string;
  stageTitle: string;
  stageHint: string;
  micVariant: 'ready' | 'live' | 'busy';
  micIcon: 'mic' | 'stop' | 'resume';
  micName: string;
  micTitle: string;
  micHint: string;
};

export type FlowSignals = { isHandsFree: boolean; endPauseMs: number };

function seconds(ms: number): string {
  return `${Number((ms / 1000).toFixed(1))} s`;
}

function listeningMicHint(isAuto: boolean, flow: FlowSignals): string {
  if (isAuto) return 'Started after Eva finished';
  return flow.isHandsFree ? 'Press to finish, or just pause' : 'Press to finish';
}

function listeningPresentation(
  state: Extract<TurnState, { tag: 'listening' | 'auto-listen' }>,
  flow: FlowSignals,
): TurnPresentation {
  const isAuto = state.tag === 'auto-listen';
  const stageHint = flow.isHandsFree
    ? `Speak naturally. A ${seconds(flow.endPauseMs)} pause ends your turn.`
    : 'Speak naturally, then press stop.';
  return {
    mood: 'listening',
    actor: 'learner',
    stageLabel: 'Your turn',
    stageTitle: isAuto ? 'Listening…' : 'Listening',
    stageHint: isAuto ? 'Started automatically after Eva. Esc to cancel.' : stageHint,
    micVariant: 'live',
    micIcon: 'stop',
    micName: 'Stop and review',
    micTitle: state.isHeld ? 'Listening, turn held open' : 'Listening…',
    micHint: listeningMicHint(isAuto, flow),
  };
}

const IDLE: TurnPresentation = {
  mood: 'idle',
  actor: 'learner',
  stageLabel: 'Your turn',
  stageTitle: 'Ready when you are',
  stageHint: 'Press the mic or hold Space to answer.',
  micVariant: 'ready',
  micIcon: 'mic',
  micName: 'Start speaking',
  micTitle: 'Press to speak',
  micHint: 'or hold Space',
};

function replyHint(fixes: TurnFix[]): string {
  if (fixes.includes('switch-to-apple')) return 'Try again or switch model';
  if (fixes.includes('open-settings')) return 'Open Settings to finish setup';
  return 'Try again in a moment';
}

function errorCopy(
  issue: TurnIssue,
): Pick<TurnPresentation, 'stageTitle' | 'micTitle' | 'micHint'> {
  if (issue.kind === 'reply') {
    return {
      stageTitle: 'No reply yet',
      micTitle: 'Eva couldn’t answer',
      micHint: replyHint(issue.fixes),
    };
  }
  return {
    stageTitle: 'Something went wrong',
    micTitle: 'Eva couldn’t continue',
    micHint: 'Use the fix above, or speak again',
  };
}

export function describeTurn(state: TurnState, flow: FlowSignals): TurnPresentation {
  switch (state.tag) {
    case 'idle':
      return IDLE;
    case 'listening':
    case 'auto-listen':
      return listeningPresentation(state, flow);
    case 'transcribing':
      return {
        ...IDLE,
        mood: 'processing',
        stageTitle: 'Got it',
        stageHint: 'Turning your speech into text…',
        micVariant: 'busy',
        micName: 'Transcribing',
        micTitle: 'Transcribing…',
        micHint: 'A moment',
      };
    case 'review':
      return {
        ...IDLE,
        stageTitle: 'Check your words',
        stageHint: 'Edit the text to stop the countdown.',
        micVariant: 'busy',
        micName: 'Re-record',
        micTitle: state.sendingLabel ? state.sendingLabel.split(' — ')[0] : 'Ready to send',
        micHint: state.sendingLabel ? 'Edit to stop' : 'Send when it reads right',
      };
    case 'thinking':
      return {
        ...IDLE,
        mood: 'thinking',
        actor: 'eva',
        stageLabel: 'Eva',
        stageTitle: 'Thinking',
        stageHint: 'You can speak anyway.',
        micVariant: 'busy',
        micName: 'Speak anyway',
        micTitle: 'Speak anyway',
        micHint: 'Interrupt the pending reply',
      };
    case 'speaking':
      return {
        ...IDLE,
        mood: 'speaking',
        actor: 'eva',
        stageLabel: 'Eva',
        stageTitle: 'Speaking',
        stageHint: 'Press the mic or Esc to interrupt.',
        micVariant: 'busy',
        micName: 'Interrupt and speak',
        micTitle: 'Eva is speaking',
        micHint: 'Press to interrupt',
      };
    case 'paused':
      return {
        ...IDLE,
        mood: 'asleep',
        actor: 'neutral',
        stageLabel: 'Paused',
        stageTitle: 'Session paused',
        stageHint: 'The microphone is released.',
        micIcon: 'resume',
        micName: 'Resume',
        micTitle: 'Paused',
        micHint: 'Microphone released — resume when ready',
      };
    case 'error':
      return {
        ...IDLE,
        mood: 'concerned',
        actor: 'neutral',
        stageLabel: 'Eva',
        stageHint: 'Your answer is safe. Pick a fix below.',
        micVariant: 'busy',
        micName: 'Speak',
        ...errorCopy(state.issue),
      };
  }
}

export type MoodExtras = { isPhraseSaved: boolean; isHelpOpen: boolean };

export function evaMoodFor(state: TurnState, flow: FlowSignals, extras: MoodExtras): EvaMood {
  if (state.tag === 'idle') {
    if (extras.isPhraseSaved) return 'happy';
    if (extras.isHelpOpen) return 'curious';
  }
  return describeTurn(state, flow).mood;
}
