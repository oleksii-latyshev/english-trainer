import { useNavigate } from '@tanstack/react-router';
import { useTrainer } from '@/context/TrainerContext';
import { useReviewCommands } from '@/features/spoken-review';
import { MemoryScreen } from '@/screens/memory';

export function MemoryRoute() {
  const { capture, practice, startMistakePractice, isSessionOpen } = useTrainer();
  const navigate = useNavigate();
  const review = useReviewCommands();

  return (
    <MemoryScreen
      isAudioBusy={practice.isBusy || !capture.canChangeSession}
      isSessionOpen={isSessionOpen}
      isStartingMistakePractice={practice.state.tag === 'starting'}
      mistakePracticeError={practice.error}
      onStartMistakePractice={() => void startMistakePractice()}
      onStartReview={() => {
        review.begin('review');
        void navigate({ to: '/memory/review' });
      }}
    />
  );
}
