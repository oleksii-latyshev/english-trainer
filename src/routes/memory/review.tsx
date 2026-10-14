import { useNavigate } from '@tanstack/react-router';
import { SpokenReviewScreen } from '@/screens/spoken-review';

export function MemoryReviewRoute() {
  const navigate = useNavigate();
  return (
    <SpokenReviewScreen
      onBackToMemory={() => void navigate({ to: '/memory' })}
      onOpenSettings={() => void navigate({ to: '/settings' })}
      onStartTalk={() => void navigate({ to: '/' })}
    />
  );
}
