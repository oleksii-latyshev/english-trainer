import { useAtomMount, useAtomValue } from '@effect/atom-react';
import { RouterProvider } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import {
  isRestoringAtom,
  isSessionOpenAtom,
  practiceStateAtom,
  restorePracticeAtom,
} from '@/core/practice-session';
import { practiceTurnEffectsAtom } from '@/core/practice-turn';
import { useFirstRunGate } from '@/routes/first-run/use-first-run-gate';
import { ToastProvider } from '@/shared/ui/toast';
import { router } from './router';
import './app/styles.css';

function useSessionNavigation() {
  const state = useAtomValue(practiceStateAtom);
  const previousTag = useRef(state.tag);
  const completedSessionId = useRef<unknown>(null);

  useEffect(() => {
    const previous = previousTag.current;
    previousTag.current = state.tag;
    if (previous === 'starting' && state.tag === 'active') {
      void router.navigate({ to: '/conversation' });
    }
    if (state.tag === 'completed' && completedSessionId.current !== state.summary.session_id) {
      completedSessionId.current = state.summary.session_id;
      void router.navigate({ to: '/summary' });
    }
  }, [state]);
}

function App() {
  useAtomMount(restorePracticeAtom);
  useAtomMount(practiceTurnEffectsAtom);
  useFirstRunGate({
    isRestoring: useAtomValue(isRestoringAtom),
    hasSession: useAtomValue(isSessionOpenAtom),
  });
  useSessionNavigation();

  return (
    <>
      <RouterProvider router={router} />
      <ToastProvider />
    </>
  );
}

export default App;
