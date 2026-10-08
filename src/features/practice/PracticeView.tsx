import { useEffect, useRef, useState } from 'react';
import { latestPausedSequence } from '@/features/coach/lib/note';
import {
  type FollowUpState,
  followUpError,
  requestTurn,
  spokenTurn,
} from '@/features/conversation/FollowUpPanel';
import { withTurnReset } from '@/features/practice/lib/controlActions';
import { type SessionDetails, sessionDetails } from '@/features/practice/lib/practiceState';
import type { SentAnswer } from '@/features/practice/lib/sentAnswer';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { type ConversationTurn, isConversationTurn } from '@/lib/types';
import type { NoteTools } from './AnswerNote';
import type { InputSource } from './lib/inputSource';
import { spokenDurationMs } from './lib/messageMeta';
import {
  canSendAnswer,
  matchingSentAnswer,
  recallSessionId,
  sendFailure,
} from './lib/practiceViewState';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { retryAnswerCoaching } from './sessionApi';
import type { TalkScreenName } from './TalkScreen';
import { TalkWorkspace } from './TalkWorkspace';
import { useAutoListen } from './useAutoListen';
import { useCoachingUpdates } from './useCoachingUpdates';
import { useDailyRecall } from './useDailyRecall';
import { usePracticeDialogue } from './usePracticeDialogue';
import { usePrewarmProvider } from './usePrewarmProvider';
import { useSecondTry } from './useSecondTry';
import { useStreamingReply } from './useStreamingReply';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
  onNavigate?: (screen: TalkScreenName) => void;
};

const IDLE_FOLLOW_UP: FollowUpState = { tag: 'idle' };

export function PracticeView({ model, actions, speech, onNavigate }: Props) {
  const [sentAnswer, setSentAnswer] = useState<SentAnswer | null>(null);
  const [phraseSavedSequence, setPhraseSavedSequence] = useState<number | null>(null);
  const [followUpRecord, setFollowUpRecord] = useState<{
    requestId: number;
    state: FollowUpState;
  }>({ requestId: model.currentRequestId, state: IDLE_FOLLOW_UP });

  const generation = useRef(0);
  const pending = useRef(false);

  const { transcript, practice, currentRequestId } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange } = actions;
  const session = sessionDetails(practice);
  const recallId = recallSessionId(session);
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
  usePrewarmProvider(activeSessionId);

  const listenAfterReply = useAutoListen(
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

  /** Marks a send as started and returns its request id. */
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

  function canSendNow(): boolean {
    return canSendAnswer({
      practiceTag: practice.tag,
      isBusy: model.busy,
      canChangeSession: model.canChangeSession,
      isPending: pending.current,
      isRetrying,
      isRecalling: recall.active,
    });
  }

  async function handleSendTurn(customText?: string, source?: InputSource) {
    if (!canSendNow()) throw new Error('The current answer cannot be sent yet.');
    const textToSend = customText ?? transcript;
    const spokenMs = spokenDurationMs(source, model.durationMs);
    if (!textToSend?.trim()) throw new Error('The answer is empty.');

    const reqId = beginSend();
    const sentAtMs = performance.now();
    try {
      const onDelta = (text: string) => {
        if (session && isLatestSend(reqId)) streamingReply.append(session.sessionId, text);
      };
      const result = await requestTurn(session?.sessionId, textToSend, source, onDelta, spokenMs);
      const replyAtMs = performance.now();
      if (!isConversationTurn(result)) throw new Error('Unexpected conversation response');
      if (session) acceptReply(session, textToSend, result);
      if (!isLatestSend(reqId)) return;
      setFollowUpRecord({
        requestId: currentRequestId,
        state: { tag: 'ready', turn: result, sentAtMs, replyAtMs },
      });
      actions.resetCapture();
      speech.play(
        spokenTurn(result),
        (voiceStartMs) => recordVoiceStart(reqId, voiceStartMs),
        () => listenAfterReply(reqId),
      );
    } catch (cause) {
      failSend(reqId, cause);
      throw cause;
    } finally {
      pending.current = false;
      onTurnPendingChange(false);
    }
  }

  const controlActions = withTurnReset(actions, {
    isRetrying,
    startRetry: () => {
      if (secondTry.sequence !== null) secondTry.start(secondTry.sequence);
    },
    resetTurnState,
  });

  const noteTools: NoteTools | null = session
    ? {
        sessionId: session.sessionId,
        turnCount: session.turnCount,
        retryEvidence: session.retryEvidence,
        secondTrySequence: secondTry.sequence,
        secondTryStatus: secondTry.status,
        latestPausedSequence: latestPausedSequence(dialogue?.coaching),
        model,
        actions: controlActions,
        onSayAgain: secondTry.start,
        onCancelSecondTry: secondTry.cancel,
        onRetryCoaching: (sequence) => {
          // The queue reports back through the update event; asking again only needs the screen to follow.
          void retryAnswerCoaching(session.sessionId, sequence)
            .catch((cause: unknown) =>
              console.warn('Could not ask for the coaching of this answer again.', cause),
            )
            .finally(retryHistory);
        },
        onSpeak: speech.play,
        onPhraseSaved: setPhraseSavedSequence,
        onPhraseSaveUndone: (sequence) =>
          setPhraseSavedSequence((current) => (current === sequence ? null : current)),
      }
    : null;

  return (
    <div className="practice-screen">
      <TalkWorkspace
        actions={controlActions}
        dialogue={dialogue}
        historyError={historyError}
        isPhraseSaved={session !== undefined && phraseSavedSequence === session.turnCount}
        isRetrying={isRetrying}
        model={model}
        noteTools={noteTools}
        onNavigate={onNavigate}
        onSend={handleSendTurn}
        pendingReply={streamingReply.pendingReply}
        recall={recall}
        retryHistory={retryHistory}
        savedAnswer={savedAnswer}
        sendError={sendFailure(followUpState)}
        session={session}
        speech={speech}
      />
    </div>
  );
}
