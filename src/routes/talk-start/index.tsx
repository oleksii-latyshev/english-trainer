import { Navigate, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTrainer } from '@/context/TrainerContext';
import { SpokenReview } from '@/features/memory/SpokenReview';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import type { PracticeOptions, StartStatus } from '@/features/practice-setup';
import { FIRST_RUN_PATH } from '@/lib/firstRun';
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
    speech,
  } = useTrainer();
  const navigate = useNavigate();
  const [warmupOptions, setWarmupOptions] = useState<PracticeOptions | null>(null);
  const warmupStarted = useRef(false);
  const warmupAlive = useRef(true);
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

  if (firstRun === 'checking') return null;
  if (firstRun === 'show') return <Navigate replace to={FIRST_RUN_PATH} />;

  if (warmupOptions) {
    return (
      <SpokenReview
        onBackToMemory={startAfterWarmup}
        onOpenSettings={() => void navigate({ to: '/settings' })}
        onStartTalk={startAfterWarmup}
        speech={speech}
        warmup
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
        warmupStarted.current = false;
        setWarmupOptions({ ...options });
      }}
      openSession={openSessionOf(session)}
      review={reviewSummary(due)}
      status={status}
    />
  );
}
