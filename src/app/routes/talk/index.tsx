import { useNavigate } from '@tanstack/react-router';
import { TalkScreen } from '@/screens/talk';

export function TalkRoute() {
  const navigate = useNavigate();
  return (
    <TalkScreen
      onChooseMicrophone={() => void navigate({ to: '/settings', hash: 'microphone' })}
      onOpenSettings={() => void navigate({ to: '/settings' })}
    />
  );
}
