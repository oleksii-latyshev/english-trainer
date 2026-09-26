import { Button } from '@heroui/react';
import { useState } from 'react';
import { CoachWorkspace } from '@/features/coach/CoachWorkspace';
import { FollowUpPanel } from '@/features/conversation/FollowUpPanel';
import { type SessionDetails, sessionDetails } from '@/features/practice/lib/practiceState';
import { type SentAnswer, sentAnswerMatches } from '@/features/practice/lib/sentAnswer';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { TimingPanel } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { TurnFeedback } from '@/lib/types';
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

  const { transcript, timing, practice, currentRequestId, speechStoppedAtMs } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange, startRecording } = actions;
  const session = sessionDetails(practice);
  const recallId = recallSessionId(session);
  const recall = useDailyRecall(recallId);
  const savedAnswer = matchingSentAnswer(sentAnswer, currentRequestId, transcript);

  function startNewAnswer() {
    setSentAnswer(null);
    setRetryAnchor(null);
    setIsRetrying(false);
    startRecording();
  }

  function finishSession() {
    actions.finishPractice();
  }

  function startSession() {
    setSentAnswer(null);
    setRetryAnchor(null);
    setIsRetrying(false);
    actions.startPractice();
  }

  function startRetry() {
    setIsRetrying(true);
    startRecording();
  }

  const controlActions = {
    ...actions,
    startRecording: isRetrying ? startRetry : startNewAnswer,
    startPractice: startSession,
    finishPractice: finishSession,
  };

  return (
    <div className="practice-screen">
      <section aria-label="Conversation workspace" hidden={activeScreen !== 'conversation'}>
        <div className="content-grid grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
          <section aria-labelledby="practice-title" className="min-w-0">
            <p className="eyebrow">PRACTICE / CONVERSATION</p>
            <h1 id="practice-title">Your voice, in English.</h1>
            <p className="intro">
              {session
                ? 'Answer Eva’s question aloud, then send your local transcript. Aim for a detailed answer each turn.'
                : 'Take a moment to answer the prompt. We’ll transcribe your words locally, then read them back so you can hear the phrasing.'}
            </p>

            <PracticeControls
              actions={controlActions}
              model={model}
              recallActive={recall.active}
              recallCompletedCount={
                recall.state.tag === 'ready' ? recall.state.plan.completed_count : 0
              }
              recallCue={recall.active ? recall.currentItem?.cue : undefined}
              recallLocked={recall.saving || recall.result !== null}
              isRetrying={isRetrying}
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

            {shouldShowFollowUp(transcript, isRetrying, recall.active) && (
              <FollowUpPanel
                isCurrent={isCurrent}
                key={`follow-up-${currentRequestId}`}
                onPendingChange={
                  practice.tag === 'active' || practice.tag === 'waiting'
                    ? onTurnPendingChange
                    : undefined
                }
                onTurn={
                  session
                    ? (turn) => {
                        setSentAnswer({
                          sessionId: session.sessionId,
                          sequence: session.turnCount + 1,
                          originalTranscript: transcript,
                          answeredQuestion: session.question,
                          requestId: currentRequestId,
                        });
                        handlePracticeTurn(session.sessionId, turn);
                      }
                    : undefined
                }
                sessionId={session?.sessionId}
                speak={speech.play}
                speechStoppedAtMs={speechStoppedAtMs}
                transcript={transcript}
              />
            )}

            {(savedAnswer !== null || Boolean(transcript)) && (
              <div className="panel mt-[18px] flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="section-kicker">COACH MODE</p>
                  <p className="m-0 text-sm font-semibold text-slate-200">
                    {savedAnswer
                      ? 'Ready for focused feedback and Try Again on this answer?'
                      : 'Want focused feedback on this answer? Open Coach to review.'}
                  </p>
                  <p className="mt-1 mb-0 text-xs text-slate-400">
                    {savedAnswer
                      ? 'Review one high-value improvement, see a B2 rewrite, and re-speak your answer.'
                      : 'Send your answer to Eva to unlock focused feedback and re-speaking.'}
                  </p>
                </div>
                <Button
                  className="secondary-action text-xs"
                  onPress={() => onNavigate?.('coach')}
                  variant="secondary"
                >
                  Open Coach →
                </Button>
              </div>
            )}

            <TimingPanel timing={timing} />
          </section>

          <SpeechPanel speech={speech} transcript={transcript} />
        </div>
      </section>

      <section aria-label="Coach workspace" hidden={activeScreen !== 'coach'}>
        <CoachWorkspace
          actions={controlActions}
          isCurrent={isCurrent}
          isRetrying={isRetrying}
          model={model}
          onCancelRetry={() => {
            actions.resetCapture();
            setIsRetrying(false);
          }}
          onContinueFromRetry={() => {
            setIsRetrying(false);
            setRetryAnchor(null);
            setSentAnswer(null);
            actions.resetCapture();
          }}
          onNavigateToConversation={() => onNavigate?.('practice')}
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
