import type { ConversationFlow } from '../../conversation-flow';

export function isFullyHandsFree(flow: ConversationFlow): boolean {
  return flow.autoListen && flow.handsFree;
}

export function effectiveAutoSendDelayMs(flow: ConversationFlow): number {
  return isFullyHandsFree(flow) ? 0 : flow.autoSendDelayMs;
}
