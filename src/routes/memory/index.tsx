import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { useContext } from 'react';
import { canChangeSessionAtom } from '@/core/answer-capture';
import {
  isSessionBusyAtom,
  isSessionOpenAtom,
  practiceErrorAtom,
  practiceStateAtom,
  startMistakePracticeAtom,
} from '@/core/practice-session';
import { useReviewCommands } from '@/features/spoken-review';
import { MemoryScreen } from '@/screens/memory';

export function MemoryRoute() {
  const registry = useContext(RegistryContext);
  const canChangeSession = useAtomValue(canChangeSessionAtom);
  const isBusy = useAtomValue(isSessionBusyAtom);
  const isSessionOpen = useAtomValue(isSessionOpenAtom);
  const practiceTag = useAtomValue(practiceStateAtom).tag;
  const practiceError = useAtomValue(practiceErrorAtom);
  const navigate = useNavigate();
  const review = useReviewCommands();

  return (
    <MemoryScreen
      isAudioBusy={isBusy || !canChangeSession}
      isSessionOpen={isSessionOpen}
      isStartingMistakePractice={practiceTag === 'starting'}
      mistakePracticeError={practiceError}
      onStartMistakePractice={() => registry.set(startMistakePracticeAtom, undefined)}
      onStartReview={() => {
        review.begin('review');
        void navigate({ to: '/memory/review' });
      }}
    />
  );
}
