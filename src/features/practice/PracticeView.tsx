import { Button } from '@heroui/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CoachWorkspace } from '@/features/coach/CoachWorkspace';
import {
  FollowUpPanel,
  type FollowUpState,
  followUpError,
  requestTurn,
  spokenTurn,
} from '@/features/conversation/FollowUpPanel';
import { type SessionDetails, sessionDetails } from '@/features/practice/lib/practiceState';
import { type SentAnswer, sentAnswerMatches } from '@/features/practice/lib/sentAnswer';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { TimingPanel } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { type ConversationTurn, isConversationTurn, type TurnFeedback } from '@/lib/types';
import { DailyRecallPanel } from './DailyRecallPanel';
import { PracticeControls } from './PracticeControls';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { TranscriptPanel } from './TranscriptPanel';
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

function matchingSentAnswer(
  answer: SentAnswer | null,
  requestId: number,
  transcript: string | undefined,
): SentAnswer | null {
  return sentAnswerMatches(answer, requestId, transcript) ? answer : null;
}

function recallSessionId(session: SessionDetails | undefined): number | undefined {
  if (!session || session.turnCount < session.targetTurns) return undefined;
  return session.sessionId;
}

function canStartRecall(model: PracticeViewModel, isRetrying: boolean): boolean {
  return model.canChangeSession && !model.busy && !isRetrying && model.practice.tag === 'active';
}

function shouldShowFollowUp(
  transcript: string | undefined,
  isRetrying: boolean,
  recallActive: boolean,
): transcript is string {
  return Boolean(transcript) && !isRetrying && !recallActive;
}

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

  const { transcript, timing, practice, currentRequestId, speechStoppedAtMs } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange, startRecording } = actions;
  const session = sessionDetails(practice);
  const recallId = recallSessionId(session);
  const recall = useDailyRecall(recallId);
  const savedAnswer = matchingSentAnswer(sentAnswer, currentRequestId, transcript);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  const followUpState: FollowUpState =
    followUpRecord.requestId === currentRequestId ? followUpRecord.state : IDLE_FOLLOW_UP;

  function acceptSentTurn(turn: ConversationTurn, sentTranscript: string) {
    if (!session) return;
    setSentAnswer({
      sessionId: session.sessionId,
      sequence: session.turnCount + 1,
      originalTranscript: sentTranscript,
      answeredQuestion: session.question,
      requestId: currentRequestId,
    });
    handlePracticeTurn(session.sessionId, turn);
  }

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
    if (practice.tag === 'active' || practice.tag === 'waiting') onTurnPendingChange(false);
  }

  function resetTurnState() {
    setSentAnswer(null);
    setRetryAnchor(null);
    setIsRetrying(false);
  }

  async function handleSendTurn() {
    if (pending.current || !transcript || isRetrying) return;
    const reqId = ++generation.current;
    pending.current = true;
    if (practice.tag === 'active' || practice.tag === 'waiting') onTurnPendingChange(true);
    setFollowUpRecord({ requestId: currentRequestId, state: { tag: 'thinking' } });
    const sentAtMs = performance.now();
    try {
      const result = await requestTurn(session?.sessionId, transcript);
      const replyAtMs = performance.now();
      if (!isConversationTurn(result)) throw new Error('Unexpected conversation response');
      if (!isLatestSend(reqId)) return;
      setFollowUpRecord({
        requestId: currentRequestId,
        state: { tag: 'ready', turn: result, sentAtMs, replyAtMs },
      });
      acceptSentTurn(result, transcript);
      speech.play(spokenTurn(result), (voiceStartMs) => recordVoiceStart(reqId, voiceStartMs));
    } catch (cause) {
      failSend(reqId, cause);
    } finally {
      finishSend();
    }
  }

  function startRetry() {
    setIsRetrying(true);
    startRecording();
  }

  const controlActions = {
    ...actions,
    startRecording: isRetrying
      ? startRetry
      : () => {
          resetTurnState();
          startRecording();
        },
    startPractice: () => {
      resetTurnState();
      actions.startPractice();
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
    />
  ) : null;

  return (
    <div className="practice-screen">
      <section aria-label="Conversation workspace" hidden={activeScreen !== 'conversation'}>
        <div className="practice-header">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
              CONVERSATION GYM · SPONTANEOUS SPOKEN TURNS
            </span>
          </div>
          <h1 id="practice-title">Your voice, in English.</h1>
          <p className="intro">
            {session
              ? 'Answer Eva’s question aloud, then send your local transcript. Aim for a detailed answer each turn.'
              : 'Take a moment to answer the prompt. We’ll transcribe your words locally, then read them back so you can hear the phrasing.'}
          </p>
        </div>

        <div className="practice-grid mt-6">
          <div className="practice-main-col">
            <PracticeControls
              actions={controlActions}
              isRetrying={isRetrying}
              model={model}
              recallActive={recall.active}
              recallCompletedCount={
                recall.state.tag === 'ready' ? recall.state.plan.completed_count : 0
              }
              recallCue={recall.active ? recall.currentItem?.cue : undefined}
              recallLocked={recall.saving || recall.result !== null}
              retryPrompt={retryAnchor?.feedback.b2_rewrite}
              surface="conversation"
            />

            {recallId !== undefined && (
              <DailyRecallPanel
                canLeave={model.canChangeSession}
                canStart={canStartRecall(model, isRetrying)}
                recall={{
                  ...recall,
                  start: () => {
                    actions.resetCapture();
                    recall.start();
                  },
                }}
                resetCapture={actions.resetCapture}
                transcript={transcript}
              />
            )}

            <TranscriptPanel transcript={transcript} />

            {activeScreen === 'conversation' ? followUpPanelNode : null}

            {(savedAnswer !== null || Boolean(transcript)) && (
              <div className="coach-gateway-banner">
                <div>
                  <p className="section-kicker !text-purple-300">DELIBERATE PRACTICE</p>
                  <p className="m-0 text-sm font-semibold text-zinc-100">
                    {savedAnswer
                      ? 'Ready for focused feedback and Try Again on this answer?'
                      : 'Want focused feedback on this answer? Open Coach to review.'}
                  </p>
                  <p className="mt-1 mb-0 text-xs text-zinc-400">
                    {savedAnswer
                      ? 'Review one high-value improvement, see a B2 rewrite, and re-speak your answer.'
                      : 'Send your answer to Eva to unlock focused feedback and re-speaking.'}
                  </p>
                </div>
                <Button
                  className="secondary-action shrink-0 !border-purple-500/30 hover:!bg-purple-500/20"
                  onPress={() => onNavigate?.('coach')}
                >
                  Open Coach →
                </Button>
              </div>
            )}

            <TimingPanel timing={timing} />
          </div>

          <div className="practice-side-col">
            <SpeechPanel speech={speech} transcript={transcript} />
          </div>
        </div>
      </section>

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
          retryAnchor={retryAnchor}
          savedAnswer={savedAnswer}
          session={session}
          speech={speech}
        />
      </section>
    </div>
  );
}
