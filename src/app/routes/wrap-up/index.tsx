import { useNavigate } from '@tanstack/react-router';
import { WrapUpScreen } from '@/screens/wrap-up';

export function WrapUpRoute() {
  const navigate = useNavigate();
  return <WrapUpScreen onLeave={() => void navigate({ to: '/' })} />;
}
