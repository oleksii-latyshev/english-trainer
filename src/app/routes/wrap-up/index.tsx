import { useNavigate } from '@tanstack/react-router';
import { WrapUpScreen } from '@/screens/wrap-up';
import { usePractiseRule } from './use-practise-rule';

export function WrapUpRoute() {
  const navigate = useNavigate();
  const practise = usePractiseRule();
  return (
    <WrapUpScreen
      isStartingRun={practise.isStartingRun}
      onLeave={() => void navigate({ to: '/' })}
      onPractiseRule={practise.onPractiseRule}
    />
  );
}
