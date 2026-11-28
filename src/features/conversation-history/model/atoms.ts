import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { ConversationHistoryService } from '../services/conversation-history-service';
import { runtime } from './runtime';

const RECENT_COUNT = 5;
export const PAGE_SIZE = 20;

export const recentConversationsAtom = runtime.atom(
  Effect.flatMap(ConversationHistoryService, (service) => service.page(RECENT_COUNT, 0)),
);

export const conversationPageAtom = Atom.family((offset: number) =>
  runtime.atom(
    Effect.flatMap(ConversationHistoryService, (service) => service.page(PAGE_SIZE, offset)),
  ),
);
