import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { conversationPageAtom, PAGE_SIZE } from '../../model/atoms';
import { ConversationRow } from '../conversation-row';

type Props = {
  onOpen: (sessionId: number) => void;
};

type PageProps = Props & {
  offset: number;
  isLast: boolean;
  onMore: () => void;
};

function Page({ offset, isLast, onMore, onOpen }: PageProps) {
  const result = useAtomValue(conversationPageAtom(offset));
  const refresh = useAtomRefresh(conversationPageAtom(offset));
  const page = Option.getOrNull(AsyncResult.value(result));
  if (page === null) {
    if (AsyncResult.isFailure(result)) {
      return (
        <li>
          <Notice
            className="rounded-control flex items-center justify-between gap-3 border"
            role="alert"
            tone="warn"
          >
            <span>Could not load your conversations.</span>
            <Button onClick={refresh} size="sm" tone="secondary">
              Retry
            </Button>
          </Notice>
        </li>
      );
    }
    return (
      <li className="text-caption text-muted" role="status">
        Loading your conversations…
      </li>
    );
  }
  return (
    <>
      {page.sessions.map((item) => (
        <li key={item.session_id}>
          <ConversationRow item={item} onOpen={onOpen} />
        </li>
      ))}
      {isLast && offset === 0 && page.sessions.length === 0 && (
        <li className="text-caption text-muted">No finished conversations yet.</li>
      )}
      {isLast && page.has_more && (
        <li className="flex justify-center">
          <Button onClick={onMore} tone="secondary">
            Show more
          </Button>
        </li>
      )}
    </>
  );
}

export function ConversationList({ onOpen }: Props) {
  const [pages, setPages] = useState(1);
  const offsets = Array.from({ length: pages }, (_, index) => index * PAGE_SIZE);
  return (
    <ul aria-label="All conversations" className="m-0 flex list-none flex-col gap-2 p-0">
      {offsets.map((offset) => (
        <Page
          isLast={offset === offsets[offsets.length - 1]}
          key={offset}
          offset={offset}
          onMore={() => setPages((count) => count + 1)}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}
