import { ConversationList } from '@/features/conversation-history';
import { Button } from '@/shared/ui/button';
import type { ConversationsScreenProps } from './types';

export function ConversationsScreen({ onBack, onOpen }: ConversationsScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-190 flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Button className="self-start" onClick={onBack} tone="ghost">
          ← Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted">Open one to see its Debrief again.</p>
      </div>
      <ConversationList onOpen={onOpen} />
    </div>
  );
}
