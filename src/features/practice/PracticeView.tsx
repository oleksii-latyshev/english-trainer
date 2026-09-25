import { FeedbackPanel } from '@/features/coach/FeedbackPanel';
import { FollowUpPanel } from '@/features/conversation/FollowUpPanel';
import { SpeechPanel } from '@/features/speech/SpeechPanel';
import { TimingPanel } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { sessionDetails } from './lib/practiceState';
import { PracticeControls } from './PracticeControls';
import type { PracticeActions, PracticeViewModel } from './practiceViewModel';
import { TranscriptPanel } from './TranscriptPanel';

type Props = {
  model: PracticeViewModel;
  actions: PracticeActions;
  speech: ReturnType<typeof useSystemSpeech>;
};

export function PracticeView({ model, actions, speech }: Props) {
  const { transcript, timing, practice, currentRequestId, speechStoppedAtMs } = model;
  const { handlePracticeTurn, isCurrent, onTurnPendingChange } = actions;
  const session = sessionDetails(practice);
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
          <span className="header-pill">LOCAL SPEECH LAB</span>
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

            <PracticeControls model={model} actions={actions} />

            <TranscriptPanel transcript={transcript} />
            {transcript && (
              <>
                <FollowUpPanel
                  isCurrent={isCurrent}
                  key={`follow-up-${currentRequestId}`}
                  onPendingChange={
                    practice.tag === 'active' || practice.tag === 'waiting'
                      ? onTurnPendingChange
                      : undefined
                  }
                  onTurn={
                    session ? (turn) => handlePracticeTurn(session.sessionId, turn) : undefined
                  }
                  sessionId={session?.sessionId}
                  speak={speech.play}
                  speechStoppedAtMs={speechStoppedAtMs}
                  transcript={transcript}
                />
                <FeedbackPanel
                  isCurrent={isCurrent}
                  key={`feedback-${currentRequestId}`}
                  question={session?.question ?? 'What was the most interesting part of your day?'}
                  transcript={transcript}
                />
              </>
            )}
            <TimingPanel timing={timing} />
          </section>

          <SpeechPanel speech={speech} transcript={transcript} />
        </div>
      </div>
    </main>
  );
}
