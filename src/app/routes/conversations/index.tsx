import { Navigate, useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { ConversationsScreen } from '@/screens/conversations';
import { WrapUpScreen } from '@/screens/wrap-up';
import { usePractiseRule } from '../wrap-up/use-practise-rule';

export function ConversationsRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <ConversationsScreen
      onBack={() => router.history.back()}
      onOpen={(sessionId) =>
        void navigate({ to: '/conversations/$sessionId', params: { sessionId: String(sessionId) } })
      }
    />
  );
}

export function ConversationRoute() {
  const router = useRouter();
  const { sessionId } = useParams({ from: '/conversations/$sessionId' });
  const practise = usePractiseRule();
  const id = Number(sessionId);
  if (!Number.isInteger(id) || id <= 0) return <Navigate replace to="/conversations" />;
  return (
    <WrapUpScreen
      isStartingRun={practise.isStartingRun}
      onLeave={() => router.history.back()}
      onPractiseRule={practise.onPractiseRule}
      sessionId={id}
    />
  );
}
