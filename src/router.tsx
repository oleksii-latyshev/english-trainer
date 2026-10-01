import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { useTrainer } from '@/context/TrainerContext';
import { DailyPracticeDashboard } from '@/features/dashboard/DailyPracticeDashboard';
import { SkillBuildersView } from '@/features/drills/SkillBuildersView';
import { HotSeatInterviewView } from '@/features/interview/HotSeatInterviewView';
import { LearningMemoryPanel } from '@/features/memory/LearningMemoryPanel';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import { PracticeCompletion } from '@/features/practice/PracticeCompletion';
import { PracticeView } from '@/features/practice/PracticeView';
import { ProgressBenchmarksView } from '@/features/progress/ProgressBenchmarksView';
import { SettingsHardwareView } from '@/features/settings/SettingsHardwareView';

// 1. Root route
export const rootRoute = createRootRoute({
  component: AppShell,
});

// 2. Route definitions
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function IndexComponent() {
    const { practice, isSessionOpen, startOrResumePractice } = useTrainer();
    const navigate = indexRoute.useNavigate();

    return (
      <DailyPracticeDashboard
        busy={practice.isBusy}
        error={practice.error}
        hasActiveSession={isSessionOpen}
        isRestoring={practice.state.tag === 'loading'}
        onNavigate={(screen) => {
          const pathMap: Record<string, string> = {
            home: '/',
            conversation: '/conversation',
            coach: '/coach',
            interview: '/interview',
            drills: '/drills',
            memory: '/memory',
            progress: '/progress',
            settings: '/settings',
            summary: '/summary',
          };
          const target = pathMap[screen] || '/';
          void navigate({ to: target });
        }}
        onOpenMemory={() => void navigate({ to: '/memory' })}
        onStartPractice={startOrResumePractice}
      />
    );
  },
});

export const conversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversation',
  component: function ConversationComponent() {
    const { practice, capture, speech, startPractice } = useTrainer();
    const navigate = conversationRoute.useNavigate();

    return (
      <PracticeView
        actions={{
          startRecording: capture.startRecording,
          stopRecording: capture.stopRecording,
          transcribeRecording: capture.transcribeRecording,
          resetCapture: capture.reset,
          startPractice,
          finishPractice: practice.finish,
          handlePracticeTurn: practice.acceptTurn,
          saveCoachAnswer: practice.saveCoachAnswer,
          continueCoachTurn: practice.continueCoachTurn,
          saveFeedback: practice.saveFeedback,
          handleRetryComparison: practice.acceptRetryComparison,
          isCurrent: () => capture.isCurrentRequest(capture.view.currentRequestId),
          onTurnPendingChange: practice.onTurnPendingChange,
        }}
        activeScreen="conversation"
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
        onNavigate={(screen) => {
          const path = screen === 'home' ? '/' : `/${screen}`;
          void navigate({ to: path });
        }}
        speech={speech}
      />
    );
  },
});

export const coachRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/coach',
  component: function CoachComponent() {
    const { practice, capture, speech, startPractice } = useTrainer();
    const navigate = coachRoute.useNavigate();

    return (
      <PracticeView
        actions={{
          startRecording: capture.startRecording,
          stopRecording: capture.stopRecording,
          transcribeRecording: capture.transcribeRecording,
          resetCapture: capture.reset,
          startPractice,
          finishPractice: practice.finish,
          handlePracticeTurn: practice.acceptTurn,
          saveCoachAnswer: practice.saveCoachAnswer,
          continueCoachTurn: practice.continueCoachTurn,
          saveFeedback: practice.saveFeedback,
          handleRetryComparison: practice.acceptRetryComparison,
          isCurrent: () => capture.isCurrentRequest(capture.view.currentRequestId),
          onTurnPendingChange: practice.onTurnPendingChange,
        }}
        activeScreen="coach"
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
        onNavigate={(screen) => {
          const path = screen === 'home' ? '/' : `/${screen}`;
          void navigate({ to: path });
        }}
        speech={speech}
      />
    );
  },
});

export const interviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/interview',
  component: function InterviewComponent() {
    const { startPractice } = useTrainer();
    return <HotSeatInterviewView onStartPractice={startPractice} />;
  },
});

export const drillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/drills',
  component: function DrillsComponent() {
    return <SkillBuildersView />;
  },
});

export const memoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/memory',
  component: function MemoryComponent() {
    const navigate = memoryRoute.useNavigate();
    return <LearningMemoryPanel onClose={() => void navigate({ to: '/' })} />;
  },
});

export const progressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/progress',
  component: function ProgressComponent() {
    return <ProgressBenchmarksView />;
  },
});

export const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: function SettingsComponent() {
    return <SettingsHardwareView />;
  },
});

export const summaryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/summary',
  component: function SummaryComponent() {
    const { practice } = useTrainer();
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
        summary={practice.state.summary}
      />
    );
  },
});

// 3. Assemble Route Tree
export const routeTree = rootRoute.addChildren([
  indexRoute,
  conversationRoute,
  coachRoute,
  interviewRoute,
  drillsRoute,
  memoryRoute,
  progressRoute,
  settingsRoute,
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
