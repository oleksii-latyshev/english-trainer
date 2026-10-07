import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { useTrainer } from '@/context/TrainerContext';
import { LearningMemoryPanel } from '@/features/memory/LearningMemoryPanel';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import { PracticeCompletion } from '@/features/practice/PracticeCompletion';
import { PracticeView } from '@/features/practice/PracticeView';
import type { TalkScreenName } from '@/features/practice/TalkScreen';
import { SettingsHardwareView } from '@/features/settings/SettingsHardwareView';
import { TalkStart } from '@/features/talk-start/TalkStart';

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
    const { practice, isSessionOpen, startOrResumePractice, due } = useTrainer();
    const navigate = indexRoute.useNavigate();

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
        onNavigate={(screen) => void navigate(talkScreenLocation(screen))}
        speech={speech}
      />
    );
  },
});

export const coachRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/coach',
  component: function CoachComponent() {
    const { practice, capture, speech, mic, startPractice } = useTrainer();
    const navigate = coachRoute.useNavigate();

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
    const { capture, speech, practice } = useTrainer();
    const navigate = memoryRoute.useNavigate();
    return (
      <LearningMemoryPanel
        capture={capture}
        onClose={() => void navigate({ to: '/' })}
        practiceBusy={practice.isBusy}
        speech={speech}
      />
    );
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
  coachRoute,
  memoryRoute,
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
