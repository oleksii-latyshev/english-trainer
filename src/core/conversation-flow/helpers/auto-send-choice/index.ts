import { AUTO_SEND_CHOICES_MS, type ConversationFlow } from '../../conversation-flow';

export type AutoSendChoice = 'off' | (typeof AUTO_SEND_CHOICES_MS)[number];

export function autoSendChoice(flow: ConversationFlow): AutoSendChoice | undefined {
  if (!flow.autoSendVoice) return 'off';
  return AUTO_SEND_CHOICES_MS.find((choice) => choice === flow.autoSendDelayMs);
}

export function autoSendPatch(choice: AutoSendChoice): Partial<ConversationFlow> {
  if (choice === 'off') return { autoSendVoice: false };
  return { autoSendVoice: true, autoSendDelayMs: choice };
}
