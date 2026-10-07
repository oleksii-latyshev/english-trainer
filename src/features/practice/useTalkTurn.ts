import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { useConversationFlow } from '@/lib/conversationFlowPreferences';
import type { InputSource } from './lib/inputSource';
import { sessionDetails } from './lib/practiceState';
import {
  deriveTurnState,
  describeTurn,
  type SendFailure,
  type TurnFix,
  turnIssue,
} from './lib/turnState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { useAnswerComposer } from './useAnswerComposer';

type Options = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  sendError?: SendFailure;
  /** The composer is locked by the screen: no session, recall, a saved Coach answer or a retry. */
  isLocked: boolean;
  isRetrying: boolean;
  isRecalling: boolean;
  /** The next prompt is being fetched. */
  isContinuing: boolean;
  pendingReply?: string;
  onSend: (text: string, source: InputSource) => Promise<void>;
  onOpenSettings: () => void;
};

/** Everything the Talk screen needs to know about the turn in progress, derived once. */
export function useTalkTurn(options: Options) {
  const { model, actions, speech, sendError, isLocked, isRetrying, isRecalling } = options;
  const { preferences: flow } = useConversationFlow();
  const isEvaSpeaking = speech.state.tag === 'starting' || speech.state.tag === 'speaking';
  const isBusy = model.busy || model.practice.tag !== 'active';

  const composer = useAnswerComposer({
    sessionId: sessionDetails(model.practice)?.sessionId,
    currentRequestId: model.currentRequestId,
    transcript: model.transcript,
    isRecording: model.status === 'recording',
    transcribing: model.transcribing,
    busy: isBusy,
    disabled: isLocked,
    isRetrying,
    recallActive: isRecalling,
    onSend: options.onSend,
    onStartRecording: actions.startRecording,
    onCancelRecording: actions.cancelRecording,
  });

  const issue = turnIssue({
    sendError,
    transcriptionFailure: model.transcriptionFailure,
    captureError: model.error,
    micStatus: model.micStatus,
    micError: model.micError,
  });
  const state = deriveTurnState({
    micStatus: model.micStatus,
    captureStatus: model.status,
    recordingMode: model.recordingMode,
    isHeld: model.held,
    isTranscribing: model.transcribing,
    hasTranscript: Boolean(model.transcript),
    sendingLabel:
      composer.autoSend.isActive && !composer.isSending ? composer.autoSend.label : undefined,
    // Once Eva speaks, the reply is complete even if its saved copy has not arrived yet.
    isThinking:
      model.practice.tag === 'waiting' ||
      composer.isSending ||
      options.isContinuing ||
      (options.pendingReply !== undefined && !isEvaSpeaking),
    isEvaSpeaking,
    issue,
  });
  const flowSignals = { isHandsFree: flow.handsFree, endPauseMs: flow.endPauseMs };

  const fixes: Record<TurnFix, { label: string; run: () => void }> = {
    'retry-send': { label: 'Retry', run: composer.sendDraft },
    'transcribe-again': { label: 'Retry', run: actions.transcribeRecording },
    'record-again': { label: 'Record again', run: composer.startRecording },
    'open-settings': { label: 'Open Settings', run: options.onOpenSettings },
    'resume-mic': { label: 'Resume mic', run: actions.resumeMic },
  };

  return {
    composer,
    flow,
    flowSignals,
    state,
    presentation: describeTurn(state, flowSignals),
    isBusy,
    fixes,
  };
}
