import { AsyncResult, Atom } from 'effect/reactivity';
import { aiSettingsAtom } from '@/core/ai-settings';
import { captureRequestIdAtom, captureStateAtom } from '@/core/answer-capture';
import { microphoneSnapshotAtom } from '@/core/audio';
import { conversationFlowAtom } from '@/core/conversation-flow';
import {
  canSendPracticeStage,
  practiceKeepsMicrophoneWarm,
  practiceStageUsesAudio,
  practiceStateAtom,
  sessionDetailsAtom,
} from '@/core/practice-session';
import {
  canVoiceInterruptAtom,
  sendFailureAtom,
  sendPendingAtom,
  turnLockAtom,
} from '@/core/practice-turn';
import { speechStateAtom } from '@/core/speech';
import { captureStatusOf, listeningOf } from '../helpers/capture-status';
import type { ComposerInteraction } from '../helpers/composer-draft';
import { turnIssue } from '../helpers/turn-issue';
import {
  canPressMic,
  deriveTurnState,
  describeTurn,
  type TurnPresentation,
  type TurnState,
} from '../helpers/turn-state';
import { countdownLabelAtom, draftAtom, isDraftFocusedAtom, isSendingAtom } from './draft-atoms';

const OFF = { status: 'off', error: '' } as const;

export const microphoneAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(microphoneSnapshotAtom), () => OFF),
);

export const interactionAtom = Atom.make((get): ComposerInteraction => {
  const session = get(sessionDetailsAtom);
  if (session === undefined) return 'voice';
  if (session.isMistakePractice) return 'spoken_rehearsal';
  if (session.practicePhase === 'writing') return 'writing';
  return session.practiceMode === 'write_then_speak' ? 'spoken_rehearsal' : 'voice';
});

export const isAudioStageAtom = Atom.make((get) => {
  const session = get(sessionDetailsAtom);
  return session !== undefined && practiceKeepsMicrophoneWarm(session);
});

export const isStageLockedAtom = Atom.make((get) => {
  const session = get(sessionDetailsAtom);
  return session === undefined || !canSendPracticeStage(session);
});

export const isLockedAtom = Atom.make((get) => get(turnLockAtom) || get(isStageLockedAtom));

export const isPracticeBusyAtom = Atom.make((get) => {
  const tag = get(practiceStateAtom).tag;
  return tag !== 'active' && tag !== 'waiting';
});

export const composerTranscriptAtom = Atom.make((get) => {
  const state = get(captureStateAtom);
  if (state.tag !== 'transcript' || get(turnLockAtom)) return null;
  return { requestId: get(captureRequestIdAtom), text: state.text, durationMs: state.durationMs };
});

export const canSwitchToAppleAtom = Atom.make((get) => {
  const settings = AsyncResult.value(get(aiSettingsAtom));
  return settings._tag === 'Some' && settings.value.provider !== 'apple';
});

export const issueAtom = Atom.make((get) => {
  const capture = get(captureStateAtom);
  const microphone = get(microphoneAtom);
  const failure = capture.tag === 'ready' || capture.tag === 'error' ? capture.failure : undefined;
  return turnIssue({
    sendError: get(sendFailureAtom),
    transcriptionFailure: failure,
    captureError: capture.tag === 'error' && !capture.failure ? capture.message : '',
    micStatus: microphone.status,
    micError: microphone.error,
    canSwitchToApple: get(canSwitchToAppleAtom),
  });
});

export const flowSignalsAtom = Atom.make((get) => {
  const flow = get(conversationFlowAtom);
  return { isHandsFree: flow.handsFree, endPauseMs: flow.endPauseMs };
});

export const turnStateAtom = Atom.make((get): TurnState => {
  const capture = get(captureStateAtom);
  const listening = listeningOf(capture);
  const speech = get(speechStateAtom).tag;
  const isSending = get(isSendingAtom);
  const countdown = get(countdownLabelAtom);
  return deriveTurnState({
    micStatus: get(microphoneAtom).status,
    captureStatus: captureStatusOf(capture),
    recordingMode: listening?.mode,
    isHeld: listening?.held ?? false,
    isTranscribing: capture.tag === 'transcribing',
    hasTranscript: get(composerTranscriptAtom) !== null,
    sendingLabel: countdown !== null && !isSending ? countdown : undefined,
    isThinking: get(practiceStateAtom).tag === 'waiting' || isSending || get(sendPendingAtom),
    isEvaSpeaking: speech === 'starting' || speech === 'speaking',
    issue: get(issueAtom),
  });
});

export const presentationAtom = Atom.make((get): TurnPresentation => {
  const state = get(turnStateAtom);
  const presentation = describeTurn(state, get(flowSignalsAtom));
  if (state.tag !== 'speaking' || !get(canVoiceInterruptAtom)) return presentation;
  return {
    ...presentation,
    stageHint: 'Start talking or press Esc to interrupt.',
    micHint: 'Speak or press to interrupt',
  };
});

export const usesAudioAtom = Atom.make((get) => {
  const session = get(sessionDetailsAtom);
  return session !== undefined && practiceStageUsesAudio(session);
});

export const canPressMicAtom = Atom.make((get) => {
  const isUnavailable = get(isLockedAtom) || get(isPracticeBusyAtom);
  return get(usesAudioAtom) && canPressMic(get(turnStateAtom), isUnavailable);
});

export const isCapturingAudioAtom = Atom.make((get) => {
  const tag = get(captureStateAtom).tag;
  return tag === 'requesting' || tag === 'recording' || tag === 'stopping';
});

export const liveTextAtom = Atom.make((get) => {
  const state = get(captureStateAtom);
  return state.tag === 'recording' && state.heardSpeech ? state.liveText : '';
});

export const levelAtom = Atom.make((get) => listeningOf(get(captureStateAtom))?.level ?? 0);

export const isComposingAtom = Atom.make(
  (get) => get(isDraftFocusedAtom) || get(draftAtom).text.trim().length > 0,
);
