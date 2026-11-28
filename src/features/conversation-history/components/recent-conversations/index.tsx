import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { recentConversationsAtom } from '../../model/atoms';
import { ConversationRow } from '../conversation-row';

type Props = {
  onOpen: (sessionId: number) => void;
  onSeeAll: () => void;
};

export function RecentConversations({ onOpen, onSeeAll }: Props) {
  const page = Option.getOrNull(AsyncResult.value(useAtomValue(recentConversationsAtom)));
  if (page === null || page.sessions.length === 0) return null;
  return (
    <GlassPanel aria-label="Recent conversations" className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-caption text-faint font-semibold">Recent conversations</h2>
        <Button onClick={onSeeAll} size="sm" tone="ghost">
          See all
        </Button>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {page.sessions.map((item) => (
          <li key={item.session_id}>
            <ConversationRow item={item} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
