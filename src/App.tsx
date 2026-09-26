import {
  BarChart3,
  Brain,
  Briefcase,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Target,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DailyPracticeDashboard } from '@/features/dashboard/DailyPracticeDashboard';
import { SkillBuildersView } from '@/features/drills/SkillBuildersView';
import { HotSeatInterviewView } from '@/features/interview/HotSeatInterviewView';
import { LearningMemoryPanel } from '@/features/memory/LearningMemoryPanel';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import { PracticeCompletion } from '@/features/practice/PracticeCompletion';
import { PracticeView } from '@/features/practice/PracticeView';
import { usePracticeSession } from '@/features/practice/usePracticeSession';
import { ProgressBenchmarksView } from '@/features/progress/ProgressBenchmarksView';
import { SettingsHardwareView } from '@/features/settings/SettingsHardwareView';
import { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import './App.css';
import './appShell.css';

export type Screen =
  | 'home'
  | 'conversation'
  | 'coach'
  | 'interview'
  | 'drills'
  | 'memory'
  | 'progress'
  | 'settings'
  | 'summary';

function screenTitle(screen: Screen): string {
  switch (screen) {
    case 'home':
      return 'Daily Practice';
    case 'conversation':
      return 'Conversation';
    case 'coach':
      return 'Coach & Re-Speaking';
    case 'interview':
      return 'The Hot Seat (Interview)';
    case 'drills':
      return 'Skill Builders & Drills';
    case 'memory':
      return 'Learning Memory';
    case 'progress':
      return 'Progress & Benchmarks';
    case 'settings':
      return 'Settings & Hardware';
    case 'summary':
      return 'Session Complete';
  }
}

type HeaderProps = {
  screen: Screen;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
};

function AppHeader({ screen, onOpenSettings, onOpenMemory }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="flex items-center">
        {/* macOS Traffic Lights */}
        <div className="window-controls">
          <span className="traffic-light traffic-light--close" />
          <span className="traffic-light traffic-light--minimize" />
          <span className="traffic-light traffic-light--maximize" />
        </div>

        <div className="window-title-area">
          <span className="brand">English Trainer</span>
          <span className="brand-badge">v0.1</span>
          <span className="text-zinc-600">›</span>
          <span className="header-context">{screenTitle(screen)}</span>
        </div>
      </div>

      <div className="header-right">
        {/* Mini Eva Header Capsule */}
        <button
          className="eva-header-capsule"
          onClick={onOpenMemory}
          title="Mini Eva: Level 3 Companion · Click for Learning Memory"
          type="button"
        >
          <span className="eva-capsule-avatar">🌱</span>
          <span className="eva-capsule-label">Mini Eva Lv.3</span>
          <span className="eva-capsule-xp">240 XP</span>
        </button>

        {/* Quick Settings Action */}
        <button
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          onClick={onOpenSettings}
          title="Open Settings & Hardware"
          type="button"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

type SidebarProps = {
  screen: Screen;
  onSelect: (next: Screen) => void;
};

type NavEntry = {
  id: Screen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const PRACTICE_MODES: NavEntry[] = [
  { id: 'home', label: 'Daily Practice', icon: LayoutDashboard },
  { id: 'conversation', label: 'Conversation', icon: MessageSquare },
  { id: 'coach', label: 'Coach Mode', icon: Target },
  { id: 'interview', label: 'The Hot Seat', icon: Briefcase },
  { id: 'drills', label: 'Skill Drills', icon: Zap },
];

function NavButton({
  item,
  active,
  onSelect,
}: {
  item: NavEntry;
  active: boolean;
  onSelect: (next: Screen) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`nav-item ${active ? 'nav-item--active' : ''}`}
      onClick={() => onSelect(item.id)}
      type="button"
    >
      <span className="nav-item-icon">
        <Icon className="h-4 w-4" />
      </span>
      <span>{item.label}</span>
      {item.badge && <span className="nav-badge">{item.badge}</span>}
    </button>
  );
}

function AppSidebar({ screen, onSelect }: SidebarProps) {
  return (
    <nav aria-label="Main navigation" className="app-sidebar">
      <p className="sidebar-label">PRACTICE MODES</p>
      {PRACTICE_MODES.map((item) => (
        <NavButton active={screen === item.id} item={item} key={item.id} onSelect={onSelect} />
      ))}

      <p className="sidebar-label">KNOWLEDGE</p>
      <NavButton
        active={screen === 'memory'}
        item={{ id: 'memory', label: 'Learning Memory', icon: Brain, badge: '18 due' }}
        onSelect={onSelect}
      />

      <p className="sidebar-label">ANALYTICS</p>
      <NavButton
        active={screen === 'progress'}
        item={{ id: 'progress', label: 'Progress', icon: BarChart3 }}
        onSelect={onSelect}
      />

      <div className="sidebar-spacer" />

      <p className="sidebar-label">SYSTEM</p>
      <NavButton
        active={screen === 'settings'}
        item={{ id: 'settings', label: 'Settings & Audio', icon: Settings }}
        onSelect={onSelect}
      />
    </nav>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-item">
        <span className="footer-dot" />
        <span>MacBook Mic (16 kHz Mono)</span>
      </div>

      <div className="footer-item">
        <span>Whisper: Base.en (Metal ⚡ 14ms)</span>
      </div>

      <div className="footer-item">
        <kbd className="footer-hotkey">Space</kbd>
        <span>Hold to Speak</span>
      </div>
    </footer>
  );
}

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

  const isSessionOpen =
    practice.state.tag === 'active' ||
    practice.state.tag === 'waiting' ||
    practice.state.tag === 'finishing';
  const previousPracticeTag = useRef(practice.state.tag);

  useEffect(() => {
    const prev = previousPracticeTag.current;
    if ((prev === 'loading' || prev === 'starting') && practice.state.tag === 'active') {
      setScreen('conversation');
    }
    if (prev === 'finishing' && practice.state.tag === 'completed') {
      setScreen('summary');
    }
    previousPracticeTag.current = practice.state.tag;
  }, [practice.state.tag]);

  function startPractice() {
    setScreen('conversation');
    practice.start();
  }

  function startOrResumePractice() {
    if (isSessionOpen) {
      setScreen('conversation');
      return;
    }
    practice.start();
  }

  function selectScreen(next: Screen) {
    if (practice.state.tag === 'completed' && next !== 'summary') {
      practice.dismissSummary();
    }
    setScreen(next);
  }

  const isPracticeActive = screen === 'conversation' || screen === 'coach';

  return (
    <div className="app-shell">
      <div className="app-frame">
        <AppHeader
          onOpenMemory={() => selectScreen('memory')}
          onOpenSettings={() => selectScreen('settings')}
          screen={screen}
        />

        <div className="app-layout">
          <AppSidebar onSelect={selectScreen} screen={screen} />

          <main className="screen-content">
            <section aria-label="Daily Practice" hidden={screen !== 'home'}>
              <DailyPracticeDashboard
                busy={practice.isBusy}
                error={practice.error}
                hasActiveSession={isSessionOpen}
                isRestoring={practice.state.tag === 'loading'}
                onNavigate={selectScreen}
                onOpenMemory={() => selectScreen('memory')}
                onStartPractice={startOrResumePractice}
              />
            </section>

            <section
              aria-label={screen === 'coach' ? 'Coach' : 'Conversation practice'}
              hidden={!isPracticeActive}
            >
              <PracticeView
                activeScreen={screen === 'coach' ? 'coach' : 'conversation'}
                key={sessionDetails(practice.state)?.sessionId ?? 'no-session'}
                model={{
                  ...capture.view,
                  practice: practice.state,
                  practiceError: practice.error,
                  busy:
                    practice.isBusy ||
                    capture.view.status === 'requesting' ||
                    capture.view.status === 'stopping',
                  canChangeSession: capture.canChangeSession,
                }}
                actions={{
                  startRecording: capture.startRecording,
                  stopRecording: capture.stopRecording,
                  transcribeRecording: capture.transcribeRecording,
                  resetCapture: capture.reset,
                  startPractice,
                  finishPractice: practice.finish,
                  handlePracticeTurn: practice.acceptTurn,
                  handleRetryComparison: practice.acceptRetryComparison,
                  isCurrent: () => capture.isCurrentRequest(capture.view.currentRequestId),
                  onTurnPendingChange: practice.onTurnPendingChange,
                }}
                onNavigate={(s) => selectScreen(s as Screen)}
                speech={speech}
              />
            </section>

            <section aria-label="The Hot Seat" hidden={screen !== 'interview'}>
              {screen === 'interview' && <HotSeatInterviewView onStartPractice={startPractice} />}
            </section>

            <section aria-label="Skill Drills" hidden={screen !== 'drills'}>
              {screen === 'drills' && <SkillBuildersView />}
            </section>

            <section aria-label="Learning Memory" hidden={screen !== 'memory'}>
              {screen === 'memory' && <LearningMemoryPanel onClose={() => selectScreen('home')} />}
            </section>

            <section aria-label="Progress & Benchmarks" hidden={screen !== 'progress'}>
              {screen === 'progress' && <ProgressBenchmarksView />}
            </section>

            <section aria-label="Settings & Hardware" hidden={screen !== 'settings'}>
              {screen === 'settings' && <SettingsHardwareView />}
            </section>

            <section aria-label="Practice summary" hidden={screen !== 'summary'}>
              {practice.state.tag === 'completed' && (
                <PracticeCompletion
                  summary={practice.state.summary}
                  onDone={() => {
                    practice.dismissSummary();
                    setScreen('home');
                  }}
                />
              )}
            </section>
          </main>
        </div>

        <AppFooter />
      </div>
    </div>
  );
}

export default App;
