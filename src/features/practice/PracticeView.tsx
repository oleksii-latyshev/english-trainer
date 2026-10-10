import { useEffect, useRef, useState } from 'react';
import { useMicrophoneActivity } from '@/audio/useMicrophoneActivity';
import { useTrainer } from '@/context/TrainerContext';
import {
  type FollowUpState,
  followUpError,
  requestTurn,
  spokenTurn,
} from '@/features/conversation/FollowUpPanel';
import { withTurnReset } from '@/features/practice/lib/controlActions';
import {
  canSendPracticeStage,
  practiceStageUsesAudio,
} from '@/features/practice/lib/practiceStage';
import { type SessionDetails, sessionDetails } from '@/features/practice/lib/practiceState';
import { preparePracticeTurn } from '@/features/practice/lib/preparePracticeTurn';
import type { SentAnswer } from '@/features/practice/lib/sentAnswer';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { useConversationFlow } from '@/lib/conversationFlowPreferences';
import { type ConversationTurn, isConversationTurn } from '@/lib/types';
import type { InputSource } from './lib/inputSource';
import {
  canSendAnswer,
  matchingSentAnswer,
  recallSessionId,
  sendFailure,
} from './lib/practiceViewState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import type { TalkScreenName } from './TalkScreen';
import { TalkWorkspace } from './TalkWorkspace';
import { useAnswerNotes } from './useAnswerNotes';
import { useAutoListen } from './useAutoListen';
import { useCoachingUpdates } from './useCoachingUpdates';
import { useDailyRecall } from './useDailyRecall';
import { usePlanningGuard } from './usePlanningGuard';
import { usePracticeDialogue } from './usePracticeDialogue';
import { usePrewarmProvider } from './usePrewarmProvider';
import { useReplyInterruption } from './useReplyInterruption';
import { useSecondTry } from './useSecondTry';
import { useStreamingReply } from './useStreamingReply';
import { useStreamSpeech } from './useStreamSpeech';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  onNavigate?: (screen: TalkScreenName) => void;
};

const IDLE_FOLLOW_UP: FollowUpState = { tag: 'idle' };

export function PracticeView({ model, actions, speech, onNavigate }: Props) {
  const [sentAnswer, setSentAnswer] = useState<SentAnswer | null>(null);
  const [followUpRecord, setFollowUpRecord] = useState<{
    requestId: number;
    state: FollowUpState;
  }>({ requestId: model.currentRequestId, state: IDLE_FOLLOW_UP });

  const generation = useRef(0);
  const pending = useRef(false);
  const planning = usePlanningGuard(actions.cancelRecording, actions.startAutoListen);
  const { mic } = useTrainer();
  const { preferences: flow } = useConversationFlow();
  const { transcript, practice, currentRequestId } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange } = actions;
  const session = sessionDetails(practice);
  const recallId = session?.isMistakePractice ? undefined : recallSessionId(session);
  const recall = useDailyRecall(recallId);
  const savedAnswer = matchingSentAnswer(sentAnswer, currentRequestId, transcript);
  const {
    dialogue,
    error: historyError,
    refetch: retryHistory,
  } = usePracticeDialogue({
    sessionId: session?.sessionId,
    turnCount: session?.turnCount,
    question: session?.question,
    phaseKey: session ? `${session.practiceMode}:${session.practicePhase}` : undefined,
  });
  useCoachingUpdates(session?.sessionId, retryHistory);

  const secondTry = useSecondTry({
    sessionId: session?.sessionId,
    transcript,
    currentRequestId,
    onCompared: actions.handleRetryComparison,
    resetCapture: actions.resetCapture,
    startRecording: actions.startRecording,
  });
  const isRetrying = secondTry.sequence !== null;
  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  const activeSessionId = session?.sessionId;
  const streamingReply = useStreamingReply(activeSessionId, dialogue?.turns.length ?? 0);
  usePrewarmProvider(
    activeSessionId,
    session?.practiceMode,
    session?.practicePhase,
    session?.isMistakePractice !== true,
  );
  const phaseKey = session ? `${session.practiceMode}:${session.practicePhase}` : undefined;
  const previousPhaseKey = useRef(phaseKey);
  useEffect(() => {
    if (previousPhaseKey.current === phaseKey) return;
    previousPhaseKey.current = phaseKey;
    generation.current += 1;
    speech.stop();
    pending.current = false;
    secondTry.cancel();
    streamingReply.clear();
    setSentAnswer(null);
    setFollowUpRecord({ requestId: model.currentRequestId, state: IDLE_FOLLOW_UP });
  }, [phaseKey, model.currentRequestId, secondTry.cancel, streamingReply.clear, speech.stop]);

  const listenAfterReply = useAutoListen(
    practice.tag === 'active' &&
      session !== undefined &&
      practiceStageUsesAudio(session) &&
      canSendPracticeStage(session) &&
      !model.busy &&
      model.canChangeSession &&
      !recall.active &&
      !isRetrying,
    generation,
    planning.startAutoListen,
  );

  const replySpeech = useStreamSpeech({ speech, generation, listenAfterReply });

  const followUpState: FollowUpState =
    followUpRecord.requestId === currentRequestId ? followUpRecord.state : IDLE_FOLLOW_UP;

  function isLatestSend(requestId: number): boolean {
    return requestId === generation.current && isCurrent();
  }

  function failSend(requestId: number, cause: unknown) {
    if (isLatestSend(requestId)) {
      streamingReply.clear();
      setFollowUpRecord({ requestId: currentRequestId, state: followUpError(cause) });
    }
  }

  function resetTurnState() {
    streamingReply.clear();
    setSentAnswer(null);
    secondTry.cancel();
  }

  function acceptReply(open: SessionDetails, answer: string, turn: ConversationTurn) {
    handlePracticeTurn(open.sessionId, turn);
    setSentAnswer({
      sessionId: open.sessionId,
      sequence: open.turnCount + 1,
      originalTranscript: answer,
      requestId: currentRequestId,
    });
  }

  function beginSend(): number {
    pending.current = true;
    onTurnPendingChange(true);
    setFollowUpRecord({ requestId: currentRequestId, state: { tag: 'thinking' } });
    if (session) {
      streamingReply.begin({
        sessionId: session.sessionId,
        savedTurnCount: session.turnCount + 1,
      });
    }
    return ++generation.current;
  }

  async function handleSendTurn(customText?: string, source?: InputSource) {
    const prepared = preparePracticeTurn({
      canSend: canSendAnswer({
        practiceTag: practice.tag,
        isBusy: model.busy,
        canChangeSession: model.canChangeSession,
        isPending: pending.current,
        isRetrying,
        isRecalling: recall.active,
      }),
      session,
      customText,
      transcript,
      source,
      durationMs: model.durationMs,
    });
    const { session: openSession, text, inputSource, spokenMs } = prepared;

    const reqId = beginSend();
    const sentAtMs = performance.now();
    const voice = replySpeech.begin({ requestId: reqId, model, session: openSession, sentAtMs });
    try {
      const onDelta = (text: string) => {
        if (!isLatestSend(reqId)) return;
        streamingReply.append(openSession.sessionId, text);
        voice?.append(text);
      };
      const result = await requestTurn(openSession.sessionId, text, inputSource, onDelta, spokenMs);
      const replyAtMs = performance.now();
      if (!isConversationTurn(result)) throw new Error('Unexpected conversation response');
      // A commit that won the race with cancellation still belongs in the saved session.
      acceptReply(openSession, text, result);
      if (!isLatestSend(reqId)) return;
      setFollowUpRecord({
        requestId: currentRequestId,
        state: { tag: 'ready', turn: result, sentAtMs, replyAtMs },
      });
      actions.resetCapture();
      voice?.finish(spokenTurn(result));
    } catch (cause) {
      voice?.cancel();
      failSend(reqId, cause);
      throw cause;
    } finally {
      if (reqId === generation.current) {
        pending.current = false;
        onTurnPendingChange(false);
      }
    }
  }

  const interruptReply = useReplyInterruption({
    generation,
    pending,
    sessionId: session?.sessionId,
    stopSpeech: speech.stop,
    isSpeaking: ['speaking', 'starting', 'paused'].includes(speech.state.tag),
    cancelPlayback: replySpeech.cancel,
    resetTurnState,
    resetFollowUp: () => setFollowUpRecord({ requestId: currentRequestId, state: IDLE_FOLLOW_UP }),
    startRecording: actions.startRecording,
    onPendingChange: onTurnPendingChange,
    onError: (cause) =>
      setFollowUpRecord({ requestId: currentRequestId, state: followUpError(cause) }),
  });

  const activity = useMicrophoneActivity({
    session: model.micStatus === 'ready' ? mic.ensure() : null,
    enabled: session !== undefined && practiceStageUsesAudio(session),
    detectSpeech:
      flow.voiceInterrupt && (speech.state.tag === 'speaking' || speech.state.tag === 'starting'),
    onSpeechStarted: () => void interruptReply(true, true),
  });

  const controlActions = withTurnReset(actions, {
    isRetrying,
    startRetry: () => {
      if (secondTry.sequence !== null) secondTry.start(secondTry.sequence);
    },
    resetTurnState,
    interruptReply,
  });

  const displayedModel = {
    ...model,
    audioLevel: activity.level,
    voiceError: replySpeech.error,
    canVoiceInterrupt: activity.canInterrupt,
    timing: { ...model.timing, ...replySpeech.timing },
  };
  const displayedSpeech = { ...speech, stop: () => void interruptReply(false) };

  const { noteTools, isPhraseSaved } = useAnswerNotes({
    session,
    dialogue,
    secondTry,
    model,
    actions: controlActions,
    speech,
    retryHistory,
  });

  return (
    <div className="practice-screen">
      <TalkWorkspace
        actions={controlActions}
        dialogue={dialogue}
        historyError={historyError}
        isPhraseSaved={isPhraseSaved}
        isRetrying={isRetrying}
        model={displayedModel}
        noteTools={noteTools}
        onNavigate={onNavigate}
        onPlanningChange={planning.onPlanningChange}
        onSend={handleSendTurn}
        pendingReply={streamingReply.pendingReply}
        recall={recall}
        retryHistory={retryHistory}
        savedAnswer={savedAnswer}
        sendError={sendFailure(followUpState)}
        session={session}
        speech={displayedSpeech}
      />
    </div>
  );
}
