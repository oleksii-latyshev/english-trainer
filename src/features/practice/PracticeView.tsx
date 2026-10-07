import { useEffect, useRef, useState } from 'react';
import { CoachWorkspace } from '@/features/coach/CoachWorkspace';
import {
  type FollowUpState,
  followUpError,
  requestTurn,
  spokenTurn,
} from '@/features/conversation/FollowUpPanel';
import { withTurnReset } from '@/features/practice/lib/controlActions';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import type { SentAnswer } from '@/features/practice/lib/sentAnswer';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { isConversationTurn, type TurnFeedback } from '@/lib/types';
import type { InputSource } from './lib/inputSource';
import {
  canSendAnswer,
  matchingSentAnswer,
  recallSessionId,
  restoredCoachAnswer,
  restoredRetryAnchor,
  sendFailure,
} from './lib/practiceViewState';
import { PracticeConversationWorkspace } from './PracticeConversationWorkspace';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import type { TalkScreenName } from './TalkScreen';
import { useAutoListen } from './useAutoListen';
import { useCoachContinue } from './useCoachContinue';
import { useDailyRecall } from './useDailyRecall';
import { usePracticeDialogue } from './usePracticeDialogue';
import { usePrewarmProvider } from './usePrewarmProvider';
import { useStreamingReply } from './useStreamingReply';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  activeScreen?: 'conversation' | 'coach';
  onNavigate?: (screen: TalkScreenName) => void;
};

const IDLE_FOLLOW_UP: FollowUpState = { tag: 'idle' };

export function PracticeView({
  model,
  actions,
  speech,
  activeScreen = 'conversation',
  onNavigate,
}: Props) {
  const [sentAnswer, setSentAnswer] = useState<SentAnswer | null>(null);
  const [retryAnchor, setRetryAnchor] = useState<(SentAnswer & { feedback: TurnFeedback }) | null>(
    null,
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [followUpRecord, setFollowUpRecord] = useState<{
    requestId: number;
    state: FollowUpState;
  }>({ requestId: model.currentRequestId, state: IDLE_FOLLOW_UP });

  const generation = useRef(0);
  const pending = useRef(false);

  const { transcript, practice, currentRequestId } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange, startRecording } = actions;
  const session = sessionDetails(practice);
  const recallId = recallSessionId(session);
  const recall = useDailyRecall(recallId);
  const persistedAnswer = restoredCoachAnswer(session);
  const savedAnswer =
    persistedAnswer ?? matchingSentAnswer(sentAnswer, currentRequestId, transcript);
  const activeRetryAnchor =
    retryAnchor ?? restoredRetryAnchor(persistedAnswer, session?.coachState?.feedback);

  const {
    dialogue,
    error: historyError,
    refetch: retryHistory,
  } = usePracticeDialogue({
    sessionId: session?.sessionId,
    turnCount: session?.turnCount,
    question: session?.question,
  });

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  const activeSessionId = session?.sessionId;
  const streamingReply = useStreamingReply(activeSessionId, dialogue?.turns.length ?? 0);
  usePrewarmProvider(activeSessionId);
  const coachContinue = useCoachContinue({
    session,
    practiceTag: practice.tag,
    isBusy: model.busy,
    canChangeSession: model.canChangeSession,
    continueCoachTurn: actions.continueCoachTurn,
    streamingReply,
    onContinued: () => {
      resetTurnState();
      setFollowUpRecord({ requestId: currentRequestId, state: IDLE_FOLLOW_UP });
    },
  });

  const listenAfterReply = useAutoListen(
    activeScreen === 'conversation' &&
      practice.tag === 'active' &&
      !model.busy &&
      model.canChangeSession &&
      !recall.active &&
      !isRetrying,
    generation,
    actions.startAutoListen,
  );

  const followUpState: FollowUpState =
    followUpRecord.requestId === currentRequestId ? followUpRecord.state : IDLE_FOLLOW_UP;

  function recordVoiceStart(requestId: number, voiceStartMs: number) {
    if (requestId !== generation.current || !isCurrent()) return;
    const audioAtMs = performance.now();
    setFollowUpRecord((current) =>
      current.requestId === currentRequestId && current.state.tag === 'ready'
        ? { ...current, state: { ...current.state, audioAtMs, voiceStartMs } }
        : current,
    );
  }

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
    setRetryAnchor(null);
    setIsRetrying(false);
  }

  async function handleSendTurn(customText?: string, source?: InputSource) {
    if (
      !canSendAnswer({
        practiceTag: practice.tag,
        isBusy: model.busy,
        canChangeSession: model.canChangeSession,
        isPending: pending.current,
        isRetrying,
        isRecalling: recall.active,
      })
    ) {
      throw new Error('The current answer cannot be sent yet.');
    }
    const textToSend = customText ?? transcript;
    if (!textToSend?.trim()) throw new Error('The answer is empty.');

    if (session?.mode === 'coach') {
      if (session.coachState?.is_pending)
        throw new Error('Review the saved answer before continuing.');
      if (!session.coachState?.is_pending) {
        pending.current = true;
        try {
          setFollowUpRecord({ requestId: currentRequestId, state: IDLE_FOLLOW_UP });
          await actions.saveCoachAnswer(session.sessionId, textToSend, source ?? 'text');
          actions.resetCapture();
        } catch (cause) {
          failSend(++generation.current, cause);
          throw cause;
        } finally {
          pending.current = false;
        }
      }
      return;
    }

    const reqId = ++generation.current;
    pending.current = true;
    onTurnPendingChange(true);
    setFollowUpRecord({ requestId: currentRequestId, state: { tag: 'thinking' } });
    if (session) {
      streamingReply.begin({
        sessionId: session.sessionId,
        savedTurnCount: session.turnCount + 1,
      });
    }
    const sentAtMs = performance.now();
    try {
      const result = await requestTurn(session?.sessionId, textToSend, source ?? 'text', (text) => {
        if (session && isLatestSend(reqId)) streamingReply.append(session.sessionId, text);
      });
      const replyAtMs = performance.now();
      if (!isConversationTurn(result)) throw new Error('Unexpected conversation response');
      if (session) {
        handlePracticeTurn(session.sessionId, textToSend, result);
        setSentAnswer({
          sessionId: session.sessionId,
          sequence: session.turnCount + 1,
          originalTranscript: textToSend,
          answeredQuestion: session.question,
          requestId: currentRequestId,
        });
      }
      if (!isLatestSend(reqId)) return;
      setFollowUpRecord({
        requestId: currentRequestId,
        state: { tag: 'ready', turn: result, sentAtMs, replyAtMs },
      });
      actions.resetCapture();
      speech.play(
        spokenTurn(result),
        (voiceStartMs) => recordVoiceStart(reqId, voiceStartMs),
        session?.mode === 'conversation' ? () => listenAfterReply(reqId) : undefined,
      );
    } catch (cause) {
      failSend(reqId, cause);
      throw cause;
    } finally {
      pending.current = false;
      onTurnPendingChange(false);
    }
  }

  function startRetry() {
    setIsRetrying(true);
    startRecording();
  }

  const controlActions = withTurnReset(actions, {
    session,
    isRetrying,
    startRetry,
    resetTurnState,
  });

  return (
    <div className="practice-screen">
      {activeScreen === 'conversation' && (
        <PracticeConversationWorkspace
          actions={controlActions}
          dialogue={dialogue}
          sendError={sendFailure(followUpState)}
          historyError={historyError}
          retryHistory={retryHistory}
          pendingReply={streamingReply.pendingReply}
          isRetrying={isRetrying}
          model={model}
          onNavigate={onNavigate}
          onSend={handleSendTurn}
          recall={recall}
          savedAnswer={savedAnswer}
          session={session}
          speech={speech}
        />
      )}

      {activeScreen === 'coach' && (
        <CoachWorkspace
          actions={controlActions}
          continueError={coachContinue.error}
          dialogue={dialogue}
          sendError={sendFailure(followUpState)}
          historyError={historyError}
          retryHistory={retryHistory}
          pendingReply={streamingReply.pendingReply}
          isContinuingCoach={coachContinue.isContinuing}
          isCurrent={isCurrent}
          isRetrying={isRetrying}
          model={model}
          onCancelRetry={() => {
            actions.resetCapture();
            setIsRetrying(false);
          }}
          onContinueCoach={() => void coachContinue.continueCoach()}
          onContinueFromRetry={() => {
            resetTurnState();
            actions.resetCapture();
          }}
          onNavigate={onNavigate}
          onRetryAnchor={setRetryAnchor}
          onSend={handleSendTurn}
          onTryAgain={startRetry}
          retryAnchor={activeRetryAnchor}
          savedAnswer={savedAnswer}
          session={session}
          speech={speech}
        />
      )}
    </div>
  );
}
