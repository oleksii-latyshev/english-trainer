import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
} from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { useTrainer } from '@/context/TrainerContext';
import { FirstRunView } from '@/features/first-run/FirstRunView';
import { LearningMemoryPanel } from '@/features/memory/LearningMemoryPanel';
import { SpokenReview } from '@/features/memory/SpokenReview';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import { PracticeCompletion } from '@/features/practice/PracticeCompletion';
import { PracticeView } from '@/features/practice/PracticeView';
import type { TalkScreenName } from '@/features/practice/TalkScreen';
import { EvaSettingsView } from '@/features/settings/EvaSettingsView';
import { SettingsView } from '@/features/settings/SettingsView';
import { TalkStart } from '@/features/talk-start/TalkStart';
import { FIRST_RUN_PATH } from '@/lib/firstRun';

function talkScreenLocation(screen: TalkScreenName): { to: string; hash?: string } {
  if (screen === 'home') return { to: '/' };
  if (screen === 'settings-microphone') return { to: '/settings', hash: 'microphone' };
  return { to: `/${screen}` };
}

// 1. Root route
export const rootRoute = createRootRoute({
  component: AppShell,
});

// 2. Route definitions
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function IndexComponent() {
    const { practice, isSessionOpen, startOrResumePractice, due, firstRun } = useTrainer();
    const navigate = indexRoute.useNavigate();

    // Launch looks for earlier use first; a brand-new learner lands on first run instead.
    if (firstRun === 'checking') return null;
    if (firstRun === 'show') return <Navigate replace to={FIRST_RUN_PATH} />;

    return (
      <TalkStart
        due={due}
        error={practice.error}
        isBusy={practice.isBusy}
        isRestoring={practice.state.tag === 'loading'}
        onOpenMemory={() => void navigate({ to: '/memory' })}
        onStartOrResume={startOrResumePractice}
        openSession={isSessionOpen ? sessionDetails(practice.state) : undefined}
      />
    );
  },
});

export const conversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversation',
  component: function ConversationComponent() {
    const { practice, capture, speech, mic, startPractice } = useTrainer();
    const navigate = conversationRoute.useNavigate();

    return (
      <PracticeView
        actions={{
          startRecording: capture.startRecording,
          stopRecording: capture.stopRecording,
          startAutoListen: capture.startAutoListen,
          cancelRecording: capture.cancelRecording,
          holdListening: capture.holdListening,
          pauseMic: mic.pause,
          resumeMic: mic.resume,
          transcribeRecording: capture.transcribeRecording,
          resetCapture: capture.reset,
          startPractice,
          finishPractice: practice.finish,
          handlePracticeTurn: practice.acceptTurn,
          handleRetryComparison: practice.acceptRetryComparison,
          isCurrent: () => capture.isCurrentRequest(capture.view.currentRequestId),
          onTurnPendingChange: practice.onTurnPendingChange,
        }}
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
        onNavigate={(screen) => void navigate(talkScreenLocation(screen))}
        speech={speech}
      />
    );
  },
});

export const memoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/memory',
  component: function MemoryComponent() {
    const { capture, practice } = useTrainer();
    const navigate = memoryRoute.useNavigate();
    return (
      <LearningMemoryPanel
        isAudioBusy={practice.isBusy || !capture.canChangeSession}
        onStartReview={() => void navigate({ to: '/memory/review' })}
      />
    );
  },
});

export const memoryReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/memory/review',
  component: function MemoryReviewComponent() {
    const { speech } = useTrainer();
    const navigate = memoryReviewRoute.useNavigate();
    return (
      <SpokenReview
        onBackToMemory={() => void navigate({ to: '/memory' })}
        onOpenSettings={() => void navigate({ to: '/settings' })}
        onStartTalk={() => void navigate({ to: '/' })}
        speech={speech}
      />
    );
  },
});

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: function SettingsComponent() {
    return <SettingsView />;
  },
});

export const settingsEvaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/eva',
  component: EvaSettingsView,
});

export const firstRunRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: FIRST_RUN_PATH,
  component: FirstRunView,
});

export const summaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/summary',
  component: function SummaryComponent() {
    const { practice, startPractice } = useTrainer();
    const navigate = summaryRoute.useNavigate();

    if (practice.state.tag !== 'completed') {
      return null;
    }

    return (
      <PracticeCompletion
        onDone={() => {
          practice.dismissSummary();
          void navigate({ to: '/' });
        }}
        onSummaryUpdated={practice.updateSummary}
        onTalkMore={() => startPractice()}
        summary={practice.state.summary}
      />
    );
  },
});

// 3. Assemble Route Tree
export const routeTree = rootRoute.addChildren([
  indexRoute,
  conversationRoute,
  memoryRoute,
  memoryReviewRoute,
  settingsRoute,
  settingsEvaRoute,
  firstRunRoute,
  summaryRoute,
]);

// 4. Create Memory History & Router Singleton
export const memoryHistory = createMemoryHistory({
  initialEntries: ['/'],
});

export const router = createRouter({
  routeTree,
  history: memoryHistory,
});

// Automatically trigger initial route load
void router.load();

export type AppRouter = typeof router;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
