import { Toast } from '@heroui/react';
import { RouterProvider } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMicrophoneSession } from '@/audio/useMicrophoneSession';
import { useFirstRunGate } from '@/features/first-run/useFirstRunGate';
import { useDuePhraseCount } from '@/features/memory/useDuePhraseCount';
import { usePracticeSession } from '@/features/practice/usePracticeSession';
import { useSpeechCapture } from '@/features/speech/useSpeechCapture';
import { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { TrainerProvider } from './context/TrainerContext';
import { router } from './router';
import './App.css';
import './appShell.css';

function App() {
  const speech = useSystemSpeech();
  const mic = useMicrophoneSession();
  const due = useDuePhraseCount();
  const capture = useSpeechCapture(speech, mic);
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

  const firstRun = useFirstRunGate({
    isRestoring: practice.state.tag === 'loading',
    hasSession: isSessionOpen,
  });

  const micActive = practice.state.tag === 'active' || practice.state.tag === 'waiting';
  const { setActive: setMicActive } = mic;
  useEffect(() => {
    setMicActive(micActive);
  }, [micActive, setMicActive]);

  const startPractice = useCallback(() => {
    void practice.start();
  }, [practice]);

  const startOrResumePractice = useCallback(() => {
    if (isSessionOpen) {
      if (practice.state.tag === 'active' || practice.state.tag === 'waiting') {
        void router.navigate({ to: '/conversation' });
      }
      return;
    }
    practice.start();
  }, [isSessionOpen, practice]);

  const trainerContext = useMemo(
    () => ({
      speech,
      capture,
      mic,
      practice,
      startPractice,
      startOrResumePractice,
      isSessionOpen,
      due,
      firstRun,
    }),
    [
      speech,
      capture,
      mic,
      practice,
      startPractice,
      startOrResumePractice,
      isSessionOpen,
      due,
      firstRun,
    ],
  );

  const previousPracticeTag = useRef(practice.state.tag);

  useEffect(() => {
    const prev = previousPracticeTag.current;
    if ((prev === 'loading' || prev === 'starting') && practice.state.tag === 'active') {
      void router.navigate({ to: '/conversation' });
    }
    if (prev === 'finishing' && practice.state.tag === 'completed') {
      void router.navigate({ to: '/summary' });
    }
    previousPracticeTag.current = practice.state.tag;
  }, [practice.state]);

  return (
    <TrainerProvider value={trainerContext}>
      <RouterProvider router={router} />
      <Toast.Provider />
    </TrainerProvider>
  );
}

export default App;
