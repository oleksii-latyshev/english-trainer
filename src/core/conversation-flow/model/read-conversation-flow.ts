import { appRegistry } from '@/core/runtime';
import type { ConversationFlow } from '../conversation-flow';
import { conversationFlowAtom } from './atoms';

let isMounted = false;

export function readConversationFlow(): ConversationFlow {
  if (!isMounted) {
    appRegistry.mount(conversationFlowAtom);
    isMounted = true;
  }
  return appRegistry.get(conversationFlowAtom);
}
