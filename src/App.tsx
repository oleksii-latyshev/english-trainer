import { RouterProvider } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePracticeSession } from '@/features/practice/usePracticeSession';
import { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import type { SessionMode } from '@/lib/types';
import { TrainerProvider } from './context/TrainerContext';
import { router } from './router';
import './App.css';
import './appShell.css';

function App() {
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

  const startPractice = useCallback(
    (mode?: SessionMode) => {
      void practice.start(mode);
    },
    [practice],
  );

  const startOrResumePractice = useCallback(() => {
    if (isSessionOpen) {
      if (practice.state.tag === 'active' || practice.state.tag === 'waiting') {
        void router.navigate({
          to: practice.state.mode === 'coach' ? '/coach' : '/conversation',
        });
      }
      return;
    }
    practice.start();
  }, [isSessionOpen, practice]);

  const trainerContext = useMemo(
    () => ({
      speech,
      capture,
      practice,
      startPractice,
      startOrResumePractice,
      isSessionOpen,
    }),
    [speech, capture, practice, startPractice, startOrResumePractice, isSessionOpen],
  );

  const previousPracticeTag = useRef(practice.state.tag);

  useEffect(() => {
    const prev = previousPracticeTag.current;
    if ((prev === 'loading' || prev === 'starting') && practice.state.tag === 'active') {
      void router.navigate({
        to:
          practice.state.tag === 'active' && practice.state.mode === 'coach'
            ? '/coach'
            : '/conversation',
      });
    }
    if (prev === 'finishing' && practice.state.tag === 'completed') {
      void router.navigate({ to: '/summary' });
    }
    previousPracticeTag.current = practice.state.tag;
  }, [practice.state]);

  return (
    <TrainerProvider value={trainerContext}>
      <RouterProvider router={router} />
    </TrainerProvider>
  );
}

export default App;
