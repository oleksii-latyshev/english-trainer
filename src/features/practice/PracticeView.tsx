import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CoachWorkspace } from '@/features/coach/CoachWorkspace';
import {
  FollowUpPanel,
  type FollowUpState,
  followUpError,
  requestTurn,
  spokenTurn,
} from '@/features/conversation/FollowUpPanel';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import type { SentAnswer } from '@/features/practice/lib/sentAnswer';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { isConversationTurn, type SessionMode, type TurnFeedback } from '@/lib/types';
import {
  matchingSentAnswer,
  recallSessionId,
  restoredCoachAnswer,
  restoredRetryAnchor,
  shouldShowFollowUp,
} from './lib/practiceViewState';
import { PracticeConversationWorkspace } from './PracticeConversationWorkspace';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { useDailyRecall } from './useDailyRecall';

type Screen = 'home' | 'practice' | 'coach' | 'memory' | 'summary';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  activeScreen?: 'conversation' | 'coach';
  onNavigate?: (screen: Screen) => void;
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
  const [isContinuingCoach, setIsContinuingCoach] = useState(false);
  const [coachContinueError, setCoachContinueError] = useState('');
  const [followUpRecord, setFollowUpRecord] = useState<{
    requestId: number;
    state: FollowUpState;
  }>({ requestId: model.currentRequestId, state: IDLE_FOLLOW_UP });

  const generation = useRef(0);
  const pending = useRef(false);

  const { transcript, practice, currentRequestId, speechStoppedAtMs } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange, startRecording } = actions;
  const session = sessionDetails(practice);
  const recallId = recallSessionId(session);
  const recall = useDailyRecall(recallId);
  const persistedAnswer = restoredCoachAnswer(session);
  const savedAnswer =
    persistedAnswer ?? matchingSentAnswer(sentAnswer, currentRequestId, transcript);
  const activeRetryAnchor =
    retryAnchor ?? restoredRetryAnchor(persistedAnswer, session?.coachState?.feedback);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

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
      setFollowUpRecord({ requestId: currentRequestId, state: followUpError(cause) });
    }
  }

  function finishSend() {
    pending.current = false;
    onTurnPendingChange(false);
  }

  function resetTurnState() {
    setSentAnswer(null);
    setRetryAnchor(null);
    setIsRetrying(false);
  }

  async function saveCoachTranscript() {
    if (!session || !transcript) return;
    pending.current = true;
    try {
      await actions.saveCoachAnswer(session.sessionId, transcript);
      actions.resetCapture();
    } catch (cause) {
      failSend(++generation.current, cause);
    } finally {
      pending.current = false;
    }
  }

  async function sendConversationTurn() {
    if (!transcript) return;
    const answerTranscript = transcript;
    const reqId = ++generation.current;
    pending.current = true;
    onTurnPendingChange(true);
    setFollowUpRecord({ requestId: currentRequestId, state: { tag: 'thinking' } });
    const sentAtMs = performance.now();
    try {
      const result = await requestTurn(session?.sessionId, answerTranscript);
      const replyAtMs = performance.now();
      if (!isConversationTurn(result)) throw new Error('Unexpected conversation response');
      session && handlePracticeTurn(session.sessionId, answerTranscript, result);
      if (!isLatestSend(reqId)) return;
      setFollowUpRecord({
        requestId: currentRequestId,
        state: { tag: 'ready', turn: result, sentAtMs, replyAtMs },
      });
      if (session) {
        setSentAnswer({
          sessionId: session.sessionId,
          sequence: session.turnCount + 1,
          originalTranscript: answerTranscript,
          answeredQuestion: session.question,
          requestId: currentRequestId,
        });
      }
      speech.play(spokenTurn(result), (voiceStartMs) => recordVoiceStart(reqId, voiceStartMs));
    } catch (cause) {
      failSend(reqId, cause);
    } finally {
      finishSend();
    }
  }

  async function handleSendTurn() {
    if (pending.current || !transcript || isRetrying) return;
    if (session?.mode === 'coach') {
      if (!session.coachState?.is_pending) await saveCoachTranscript();
      return;
    }
    await sendConversationTurn();
  }

  function startRetry() {
    setIsRetrying(true);
    startRecording();
  }

  async function continueCoach() {
    if (
      session?.mode !== 'coach' ||
      !session.coachState?.is_pending ||
      isContinuingCoach ||
      practice.tag !== 'active' ||
      !model.canChangeSession ||
      model.busy
    )
      return;
    setIsContinuingCoach(true);
    setCoachContinueError('');
    try {
      await actions.continueCoachTurn(session.sessionId, session.coachState.sequence);
      setSentAnswer(null);
      setRetryAnchor(null);
      setIsRetrying(false);
      setFollowUpRecord({ requestId: currentRequestId, state: IDLE_FOLLOW_UP });
    } catch {
      setCoachContinueError(
        'Could not get the next Coach prompt. Your saved answer is still here; retry Continue when ready.',
      );
    } finally {
      setIsContinuingCoach(false);
    }
  }

  const controlActions = {
    ...actions,
    startRecording: isRetrying
      ? startRetry
      : () => {
          if (session?.mode === 'coach' && session.coachState?.is_pending) return;
          resetTurnState();
          startRecording();
        },
    startPractice: (mode?: SessionMode) => {
      resetTurnState();
      actions.startPractice(mode);
    },
    finishPractice: actions.finishPractice,
  };

  const showFollowUp = shouldShowFollowUp(transcript, isRetrying, recall.active);

  const followUpPanelNode: ReactNode = showFollowUp ? (
    <FollowUpPanel
      key={`follow-up-${currentRequestId}`}
      onAskFollowUp={handleSendTurn}
      sessionId={session?.sessionId}
      speechStoppedAtMs={speechStoppedAtMs}
      state={followUpState}
      surface={activeScreen}
      localCoach={session?.mode === 'coach'}
    />
  ) : null;

  return (
    <div className="practice-screen">
      <PracticeConversationWorkspace
        model={model}
        speech={speech}
        activeScreen={activeScreen}
        session={session}
        actions={controlActions}
        recall={recall}
        isRetrying={isRetrying}
        retryPrompt={activeRetryAnchor?.feedback.b2_rewrite}
        followUpPanel={followUpPanelNode}
        savedAnswer={savedAnswer}
        onNavigate={onNavigate}
      />

      <section aria-label="Coach workspace" hidden={activeScreen !== 'coach'}>
        <CoachWorkspace
          actions={controlActions}
          followUpPanel={activeScreen === 'coach' ? followUpPanelNode : null}
          isCurrent={isCurrent}
          isRetrying={isRetrying}
          model={model}
          onCancelRetry={() => {
            actions.resetCapture();
            setIsRetrying(false);
          }}
          onContinueFromRetry={() => {
            resetTurnState();
            actions.resetCapture();
          }}
          onRetryAnchor={setRetryAnchor}
          onTryAgain={startRetry}
          retryAnchor={activeRetryAnchor}
          savedAnswer={savedAnswer}
          session={session}
          speech={speech}
          onContinueCoach={() => void continueCoach()}
          isContinuingCoach={isContinuingCoach}
          continueError={coachContinueError}
        />
      </section>
    </div>
  );
}
