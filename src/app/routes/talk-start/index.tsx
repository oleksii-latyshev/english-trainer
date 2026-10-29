import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { Navigate, useNavigate } from '@tanstack/react-router';
import { useContext, useEffect, useRef, useState } from 'react';
import { useFirstRunDecision } from '@/app/routes/first-run/use-first-run-gate';
import { FIRST_RUN_PATH } from '@/core/first-run';
import { dueMemory, learningMemoryAtom } from '@/core/learning-memory';
import {
  isRestoringAtom,
  isSessionBusyAtom,
  isSessionOpenAtom,
  practiceErrorAtom,
  practiceStateAtom,
  sessionDetails,
  startOrResumePractice,
  startPracticeAtom,
} from '@/core/practice-session';
import { learnerNameAtom } from '@/features/personal-profile';
import type { PracticeOptions, StartStatus } from '@/features/practice-setup';
import { useReviewCommands, useWarmupHandoff } from '@/features/spoken-review';
import { SpokenReviewScreen } from '@/screens/spoken-review';
import { TalkStartScreen } from '@/screens/talk-start';
import { openSessionOf, reviewSummary } from './summaries';

function startStatus(isRestoring: boolean, isBusy: boolean): StartStatus {
  if (isRestoring) return 'restoring';
  return isBusy ? 'starting' : 'ready';
}

export function TalkStartRoute() {
  const registry = useContext(RegistryContext);
  const practiceState = useAtomValue(practiceStateAtom);
  const practiceError = useAtomValue(practiceErrorAtom);
  const isBusy = useAtomValue(isSessionBusyAtom);
  const isSessionOpen = useAtomValue(isSessionOpenAtom);
  const isRestoring = useAtomValue(isRestoringAtom);
  const due = dueMemory(useAtomValue(learningMemoryAtom));
  const learnerName = useAtomValue(learnerNameAtom);
  const firstRun = useFirstRunDecision();
  const navigate = useNavigate();

  function startPractice(options?: PracticeOptions) {
    registry.set(startPracticeAtom, options);
  }
  const [warmupOptions, setWarmupOptions] = useState<PracticeOptions | null>(null);
  const warmupStarted = useRef(false);
  const warmupAlive = useRef(true);
  const review = useReviewCommands();
  const isWarmupFinished = useWarmupHandoff();
  useEffect(() => {
    warmupAlive.current = true;
    return () => {
      warmupAlive.current = false;
    };
  }, []);
  function startAfterWarmup() {
    if (!warmupAlive.current || !warmupOptions || warmupStarted.current) return;
    warmupStarted.current = true;
    const snapshot = { ...warmupOptions };
    setWarmupOptions(null);
    startPractice(snapshot);
  }

  useEffect(() => {
    if (warmupOptions && isWarmupFinished) startAfterWarmup();
  });

  if (firstRun === 'checking') return null;
  if (firstRun === 'show') return <Navigate replace to={FIRST_RUN_PATH} />;

  if (warmupOptions) {
    return (
      <SpokenReviewScreen
        onBackToMemory={startAfterWarmup}
        onOpenSettings={() => void navigate({ to: '/settings' })}
        onStartTalk={startAfterWarmup}
      />
    );
  }

  const status = startStatus(isRestoring, isBusy);
  const session = isSessionOpen ? sessionDetails(practiceState) : undefined;

  return (
    <TalkStartScreen
      error={practiceError}
      learnerName={learnerName}
      onContinue={() =>
        startOrResumePractice(registry, () => void navigate({ to: '/conversation' }))
      }
      onOpenMemory={() => void navigate({ to: '/memory' })}
      onOpenMistakes={() => void navigate({ to: '/mistakes' })}
      onStart={startPractice}
      onStartWarmup={(options) => {
        review.begin('warmup');
        warmupStarted.current = false;
        setWarmupOptions({ ...options });
      }}
      openSession={openSessionOf(session)}
      review={reviewSummary(due)}
      status={status}
    />
  );
}
