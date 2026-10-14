import { Navigate, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTrainer } from '@/context/TrainerContext';
import { FIRST_RUN_PATH } from '@/core/first-run';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import type { PracticeOptions, StartStatus } from '@/features/practice-setup';
import { useReviewCommands, useWarmupHandoff } from '@/features/spoken-review';
import { SpokenReviewScreen } from '@/screens/spoken-review';
import { TalkStartScreen } from '@/screens/talk-start';
import { mistakePracticeSummary, openSessionOf, reviewSummary } from './summaries';

function startStatus(isRestoring: boolean, isBusy: boolean): StartStatus {
  if (isRestoring) return 'restoring';
  return isBusy ? 'starting' : 'ready';
}

export function TalkStartRoute() {
  const {
    practice,
    capture,
    isSessionOpen,
    startOrResumePractice,
    startPractice,
    startMistakePractice,
    due,
    firstRun,
  } = useTrainer();
  const navigate = useNavigate();
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

  const isRestoring = practice.state.tag === 'loading';
  const status = startStatus(isRestoring, practice.isBusy);
  const session = isSessionOpen ? sessionDetails(practice.state) : undefined;

  return (
    <TalkStartScreen
      error={practice.error}
      mistakePractice={mistakePracticeSummary(due, {
        isSessionOpen,
        isAudioBusy: practice.isBusy || !capture.canChangeSession,
        isStarting: practice.state.tag === 'starting',
      })}
      onContinue={startOrResumePractice}
      onOpenMemory={() => void navigate({ to: '/memory' })}
      onPracticeMistakes={() => void startMistakePractice()}
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
