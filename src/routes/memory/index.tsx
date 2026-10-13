import { useNavigate } from '@tanstack/react-router';
import { useTrainer } from '@/context/TrainerContext';
import { useActiveReview } from '@/features/memory/useActiveReview';
import { MemoryScreen } from '@/screens/memory';

export function MemoryRoute() {
  const { capture, practice, startMistakePractice, isSessionOpen } = useTrainer();
  const navigate = useNavigate();
  const activeReview = useActiveReview();

  return (
    <MemoryScreen
      activeReview={activeReview}
      isAudioBusy={practice.isBusy || !capture.canChangeSession}
      isSessionOpen={isSessionOpen}
      isStartingMistakePractice={practice.state.tag === 'starting'}
      mistakePracticeError={practice.error}
      onStartMistakePractice={() => void startMistakePractice()}
      onStartReview={() => void navigate({ to: '/memory/review' })}
    />
  );
}
