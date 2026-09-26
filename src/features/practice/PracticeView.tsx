import { useState } from 'react';
import { RetryComparisonPanel } from '@/features/coach/RetryComparisonPanel';
import { FollowUpPanel } from '@/features/conversation/FollowUpPanel';
import { type SessionDetails, sessionDetails } from '@/features/practice/lib/practiceState';
import { type SentAnswer, sentAnswerMatches } from '@/features/practice/lib/sentAnswer';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { TimingPanel } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { TurnFeedback } from '@/lib/types';
import { DailyRecallPanel } from './DailyRecallPanel';
import { PracticeControls } from './PracticeControls';
import { PracticeFeedbackArea } from './PracticeFeedbackArea';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { retryPracticeTurn } from './sessionApi';
import { TranscriptPanel } from './TranscriptPanel';
import { useDailyRecall } from './useDailyRecall';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
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

export function PracticeView({ model, actions, speech }: Props) {
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
      <div className="content-grid grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <section aria-labelledby="practice-title" className="min-w-0">
          <p className="eyebrow">PRACTICE / SPEAKING</p>
          <h1 id="practice-title">Your voice, in English.</h1>
          <p className="intro">
            {session
              ? 'Answer Eva’s question aloud, then send your local transcript. Aim for a detailed answer each turn.'
              : 'Take a moment to answer the prompt. We’ll transcribe your words locally, then read them back so you can hear the phrasing.'}
          </p>

          <PracticeControls
            model={model}
            actions={controlActions}
            recallCue={recall.active ? recall.currentItem?.cue : undefined}
            recallActive={recall.active}
            recallCompletedCount={
              recall.state.tag === 'ready' ? recall.state.plan.completed_count : 0
            }
            recallLocked={recall.saving || recall.result !== null}
          />

          {recallId !== undefined && (
            <DailyRecallPanel
              recall={{
                ...recall,
                start: () => {
                  actions.resetCapture();
                  recall.start();
                },
              }}
              transcript={transcript}
              resetCapture={actions.resetCapture}
              canStart={canStartRecall(model, isRetrying)}
              canLeave={model.canChangeSession}
            />
          )}

          {session?.retryEvidence.map((evidence) => (
            <article className="panel mt-[18px] p-5" key={evidence.turn_sequence}>
              <p className="section-kicker">SAVED TRY AGAIN · TURN {evidence.turn_sequence}</p>
              <p className="m-0 text-sm text-slate-300">
                Target wording evidence: {evidence.target_evidence.replace(/_/g, ' ')} · Hesitation:{' '}
                {evidence.hesitation}
              </p>
              <p className="mt-2 mb-0 text-xs text-slate-400">
                Original: {evidence.original_transcript}
              </p>
              <p className="mt-1 mb-0 text-xs text-slate-400">Retry: {evidence.retry_transcript}</p>
            </article>
          ))}

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
          <PracticeFeedbackArea
            transcript={transcript}
            requestId={currentRequestId}
            session={session}
            savedAnswer={savedAnswer}
            retryAnchor={retryAnchor}
            isRetrying={isRetrying}
            recallActive={recall.active}
            isCurrent={isCurrent}
            onRetryAnchor={setRetryAnchor}
            onTryAgain={startRetry}
          />
          {isRetrying && retryAnchor && (
            <RetryComparisonPanel
              key={`retry-${retryAnchor.requestId}`}
              attemptId={currentRequestId}
              original={retryAnchor.originalTranscript}
              retry={transcript}
              onCompare={(retryTranscript) =>
                retryPracticeTurn(retryAnchor.sessionId, retryAnchor.sequence, retryTranscript)
              }
              onSaved={(comparison) =>
                actions.handleRetryComparison(retryAnchor.sessionId, comparison)
              }
              onContinue={() => {
                setIsRetrying(false);
                setRetryAnchor(null);
                setSentAnswer(null);
                startRecording();
              }}
            />
          )}
          <TimingPanel timing={timing} />
        </section>

        <SpeechPanel speech={speech} transcript={transcript} />
      </div>
    </div>
  );
}
