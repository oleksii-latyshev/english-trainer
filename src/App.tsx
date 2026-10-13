import { useAtomValue } from '@effect/atom-react';
import { RouterProvider } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useMicrophoneSession } from '@/app/microphone';
import { useSpeechCapture } from '@/app/speech-capture';
import { dueMemory, learningMemoryAtom } from '@/core/learning-memory';
import { useSpeech } from '@/core/speech';
import { useFirstRunGate } from '@/features/first-run/useFirstRunGate';
import { practiceKeepsMicrophoneWarm } from '@/features/practice/lib/practiceStage';
import { sessionDetails } from '@/features/practice/lib/practiceState';
import { usePracticeSession } from '@/features/practice/usePracticeSession';
import type { PracticeOptions } from '@/lib/practiceOptions';
import { ToastProvider } from '@/shared/ui/toast';
import { TrainerProvider } from './context/TrainerContext';
import { router } from './router';
import './app/styles.css';

function App() {
  const speech = useSpeech();
  const mic = useMicrophoneSession();
  const due = dueMemory(useAtomValue(learningMemoryAtom));
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

  const session = sessionDetails(practice.state);
  const micActive =
    (practice.state.tag === 'active' || practice.state.tag === 'waiting') &&
    session !== undefined &&
    practiceKeepsMicrophoneWarm(session);
  const { setActive: setMicActive } = mic;
  useEffect(() => {
    setMicActive(micActive);
  }, [micActive, setMicActive]);

  const startPractice = useCallback(
    async (options?: PracticeOptions) => {
      if (await practice.start(options)) {
        await router.navigate({ to: '/conversation' });
      }
    },
    [practice],
  );

  const startOrResumePractice = useCallback(() => {
    if (isSessionOpen) {
      if (practice.state.tag === 'active' || practice.state.tag === 'waiting') {
        void router.navigate({ to: '/conversation' });
      }
      return;
    }
    void startPractice();
  }, [isSessionOpen, practice.state, startPractice]);

  const startMistakePractice = useCallback(async () => {
    const started = await practice.startMistakePractice();
    if (started) await router.navigate({ to: '/conversation' });
    return started;
  }, [practice]);

  const trainerContext = useMemo(
    () => ({
      speech,
      capture,
      mic,
      practice,
      startPractice,
      startMistakePractice,
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
      startMistakePractice,
      startOrResumePractice,
      isSessionOpen,
      due,
      firstRun,
    ],
  );

  const completedSessionId = useRef<number | null>(null);

  useEffect(() => {
    if (
      practice.state.tag === 'completed' &&
      completedSessionId.current !== practice.state.summary.session_id
    ) {
      completedSessionId.current = practice.state.summary.session_id;
      void router.navigate({ to: '/summary' });
    }
  }, [practice.state]);

  return (
    <TrainerProvider value={trainerContext}>
      <RouterProvider router={router} />
      <ToastProvider />
    </TrainerProvider>
  );
}

export default App;
