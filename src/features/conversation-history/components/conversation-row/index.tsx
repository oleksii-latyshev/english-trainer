import { ChevronRight } from 'lucide-react';
import { CardButton } from '@/shared/ui/card-button';
import { conversationDetail } from '../../helpers/conversation-detail';
import type { ConversationItem } from '../../types';

type Props = {
  item: ConversationItem;
  onOpen: (sessionId: number) => void;
};

export function ConversationRow({ item, onOpen }: Props) {
  const detail = conversationDetail(item);
  return (
    <CardButton
      aria-label={`${item.title}, ${detail}`}
      className="flex-row items-center justify-between gap-3"
      onClick={() => onOpen(item.session_id)}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-control truncate font-semibold">{item.title}</span>
        <span className="text-caption text-faint truncate">{detail}</span>
      </span>
      <ChevronRight aria-hidden="true" className="text-faint shrink-0" size={16} />
    </CardButton>
  );
}
