import { Button } from '@heroui/react';
import { useState } from 'react';
import { FeedbackPanel } from '@/features/coach/FeedbackPanel';
import { RetryComparisonPanel } from '@/features/coach/RetryComparisonPanel';
import { FollowUpPanel } from '@/features/conversation/FollowUpPanel';
import { LearningMemoryPanel } from '@/features/memory/LearningMemoryPanel';
import { savePhraseCard } from '@/features/memory/memoryApi';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import { type SentAnswer, sentAnswerMatches } from '@/features/practice/lib/sentAnswer';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { TimingPanel } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { TurnFeedback } from '@/lib/types';
import { PracticeControls } from './PracticeControls';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { retryPracticeTurn, savePracticeFeedback } from './sessionApi';
import { TranscriptPanel } from './TranscriptPanel';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
};

function feedbackQuestion(
  retryAnchor: SentAnswer | null,
  savedAnswer: SentAnswer | null,
  sessionQuestion?: string,
): string {
  return (
    retryAnchor?.answeredQuestion ??
    savedAnswer?.answeredQuestion ??
    sessionQuestion ??
    'What was the most interesting part of your day?'
  );
}

function matchingSentAnswer(
  answer: SentAnswer | null,
  requestId: number,
  transcript: string | undefined,
): SentAnswer | null {
  return sentAnswerMatches(answer, requestId, transcript) ? answer : null;
}

export function PracticeView({ model, actions, speech }: Props) {
  const [sentAnswer, setSentAnswer] = useState<SentAnswer | null>(null);
  const [retryAnchor, setRetryAnchor] = useState<(SentAnswer & { feedback: TurnFeedback }) | null>(
    null,
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const { transcript, timing, practice, currentRequestId, speechStoppedAtMs } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange, startRecording } = actions;
  const session = sessionDetails(practice);
  const savedAnswer = matchingSentAnswer(sentAnswer, currentRequestId, transcript);

  function startNewAnswer() {
    setSentAnswer(null);
    setRetryAnchor(null);
    setIsRetrying(false);
    startRecording();
  }

  function finishSession() {
    setSentAnswer(null);
    setRetryAnchor(null);
    setIsRetrying(false);
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
    <main className="app-shell min-h-screen text-slate-100">
      <div className="app-frame mx-auto w-full max-w-6xl">
        <header className="app-header flex items-center justify-between gap-4">
          <div className="brand flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true">
              ✦
            </span>
            <span>English Trainer</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="secondary-action text-xs"
              onPress={() => setIsMemoryOpen((open) => !open)}
              variant="secondary"
            >
              {isMemoryOpen ? 'Back to Practice' : 'Learning Memory'}
            </Button>
            <span className="header-pill">LOCAL SPEECH LAB</span>
          </div>
        </header>

        <div className="content-grid grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
          <section aria-labelledby="practice-title" className="min-w-0">
            <p className="eyebrow">PRACTICE / SPEAKING</p>
            <h1 id="practice-title">Your voice, in English.</h1>
            <p className="intro">
              {session
                ? 'Answer Eva’s question aloud, then send your local transcript. Aim for a detailed answer each turn.'
                : 'Take a moment to answer the prompt. We’ll transcribe your words locally, then read them back so you can hear the phrasing.'}
            </p>

            <PracticeControls model={model} actions={controlActions} />

            {isMemoryOpen && <LearningMemoryPanel onClose={() => setIsMemoryOpen(false)} />}

            {session?.retryEvidence.map((evidence) => (
              <article className="panel mt-[18px] p-5" key={evidence.turn_sequence}>
                <p className="section-kicker">SAVED TRY AGAIN · TURN {evidence.turn_sequence}</p>
                <p className="m-0 text-sm text-slate-300">
                  Target wording evidence: {evidence.target_evidence.replace(/_/g, ' ')} ·
                  Hesitation: {evidence.hesitation}
                </p>
                <p className="mt-2 mb-0 text-xs text-slate-400">
                  Original: {evidence.original_transcript}
                </p>
                <p className="mt-1 mb-0 text-xs text-slate-400">
                  Retry: {evidence.retry_transcript}
                </p>
              </article>
            ))}

            <TranscriptPanel transcript={transcript} />
            {transcript && !isRetrying && (
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
            {(transcript || retryAnchor) && (
              <FeedbackPanel
                isCurrent={isCurrent}
                key={`feedback-${retryAnchor?.requestId ?? currentRequestId}`}
                onReviewed={(feedback) => {
                  if (savedAnswer) setRetryAnchor({ ...savedAnswer, feedback });
                }}
                onSavePhrase={savePhraseCard}
                onTryAgain={retryAnchor ? startRetry : undefined}
                initialFeedback={isRetrying ? retryAnchor?.feedback : undefined}
                isAnswerSent={session === undefined || savedAnswer !== null || retryAnchor !== null}
                canReview={!isRetrying}
                sessionId={savedAnswer?.sessionId ?? retryAnchor?.sessionId}
                sequence={savedAnswer?.sequence ?? retryAnchor?.sequence}
                persistReviewed={
                  savedAnswer
                    ? (_answer, feedback) =>
                        savePracticeFeedback(
                          savedAnswer.sessionId,
                          savedAnswer.sequence,
                          savedAnswer.originalTranscript,
                          feedback,
                        )
                    : undefined
                }
                question={feedbackQuestion(retryAnchor, savedAnswer, session?.question)}
                transcript={retryAnchor?.originalTranscript ?? transcript ?? ''}
              />
            )}
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
    </main>
  );
}
