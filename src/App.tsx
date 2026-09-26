import { Button } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import { DailyPracticeDashboard } from '@/features/dashboard/DailyPracticeDashboard';
import { LearningMemoryPanel } from '@/features/memory/LearningMemoryPanel';
import { PracticeView } from '@/features/practice/PracticeView';
import { usePracticeSession } from '@/features/practice/usePracticeSession';
import { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import './App.css';
import './appShell.css';

type Screen = 'home' | 'practice' | 'memory';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const speech = useSystemSpeech();
  const capture = useSpeechCapture(speech);
  const practice = usePracticeSession({
    canChangeSession: capture.canChangeSession,
    resetCapture: capture.reset,
    playQuestion: speech.play,
    stopSpeech: speech.stop,
  });
  const currentRequestId = capture.view.currentRequestId;
  const isBusy =
    practice.isBusy || capture.view.status === 'requesting' || capture.view.status === 'stopping';
  const isSessionOpen =
    practice.state.tag === 'active' ||
    practice.state.tag === 'waiting' ||
    practice.state.tag === 'finishing';
  const previousPracticeTag = useRef(practice.state.tag);

  useEffect(() => {
    if (
      (previousPracticeTag.current === 'loading' || previousPracticeTag.current === 'starting') &&
      practice.state.tag === 'active'
    ) {
      setScreen('practice');
    }
    if (previousPracticeTag.current === 'finishing' && practice.state.tag === 'idle') {
      setScreen('home');
    }
    previousPracticeTag.current = practice.state.tag;
  }, [practice.state.tag]);

  function startPractice() {
    setScreen('practice');
    practice.start();
  }

  function finishPractice() {
    practice.finish();
  }

  function selectScreen(next: Screen) {
    setScreen(next);
  }

  function startOrResumePractice() {
    if (isSessionOpen) {
      setScreen('practice');
      return;
    }
    practice.start();
  }

  return (
    <div className="app-shell min-h-screen text-slate-100">
      <div className="app-frame">
        <header className="app-header flex items-center gap-4">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>
          <span className="brand">English Trainer</span>
          <span className="header-context">
            {screen === 'home'
              ? 'Daily Practice'
              : screen === 'memory'
                ? 'Learning Memory'
                : 'Practice'}
          </span>
        </header>

        <div className="app-layout">
          <nav aria-label="Main navigation" className="app-sidebar">
            <p className="sidebar-label">PRACTICE</p>
            <Button
              aria-current={screen === 'home' ? 'page' : undefined}
              className={`nav-item ${screen === 'home' ? 'nav-item--active' : ''}`}
              onPress={() => selectScreen('home')}
              variant="tertiary"
            >
              <span aria-hidden="true">⌂</span> Home
            </Button>
            <Button
              aria-current={screen === 'practice' ? 'page' : undefined}
              className={`nav-item ${screen === 'practice' ? 'nav-item--active' : ''}`}
              onPress={() => selectScreen('practice')}
              variant="tertiary"
            >
              <span aria-hidden="true">◉</span> Conversation
            </Button>
            <p className="sidebar-label sidebar-label--spaced">LEARNING</p>
            <Button
              aria-current={screen === 'memory' ? 'page' : undefined}
              className={`nav-item ${screen === 'memory' ? 'nav-item--active' : ''}`}
              onPress={() => selectScreen('memory')}
              variant="tertiary"
            >
              <span aria-hidden="true">▤</span> Learning Memory
            </Button>
            <p className="sidebar-note">
              More practice modes will appear here as they become available.
            </p>
          </nav>

          <main className="screen-content">
            <section aria-label="Daily Practice" hidden={screen !== 'home'}>
              <DailyPracticeDashboard
                busy={practice.isBusy}
                error={practice.error}
                hasActiveSession={isSessionOpen}
                isRestoring={practice.state.tag === 'loading'}
                onOpenMemory={() => selectScreen('memory')}
                onStartPractice={startOrResumePractice}
              />
            </section>
            <section aria-label="Conversation practice" hidden={screen !== 'practice'}>
              <PracticeView
                model={{
                  ...capture.view,
                  practice: practice.state,
                  practiceError: practice.error,
                  busy: isBusy,
                }}
                actions={{
                  startRecording: capture.startRecording,
                  stopRecording: capture.stopRecording,
                  transcribeRecording: capture.transcribeRecording,
                  startPractice,
                  finishPractice,
                  handlePracticeTurn: practice.acceptTurn,
                  handleRetryComparison: practice.acceptRetryComparison,
                  isCurrent: () => capture.isCurrentRequest(currentRequestId),
                  onTurnPendingChange: practice.onTurnPendingChange,
                }}
                speech={speech}
              />
            </section>
            <section aria-label="Learning Memory" hidden={screen !== 'memory'}>
              {screen === 'memory' && <LearningMemoryPanel />}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
