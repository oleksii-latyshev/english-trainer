export type ConversationFlow = {
  autoListen: boolean;
  handsFree: boolean;
  endPauseMs: number;
  autoSendVoice: boolean;
  autoSendDelayMs: number;
  voiceInterrupt: boolean;
};

export const END_PAUSE_RANGE_MS = { min: 1000, max: 3000 } as const;
export const AUTO_SEND_DELAY_RANGE_MS = { min: 0, max: 5000 } as const;

export const END_PAUSE_CHOICES_MS = [1000, 1500, 2000, 3000] as const;
export const AUTO_SEND_CHOICES_MS = [1000, 2000, 3000] as const;

export const DEFAULT_CONVERSATION_FLOW: ConversationFlow = {
  autoListen: true,
  handsFree: true,
  endPauseMs: 1500,
  autoSendVoice: true,
  autoSendDelayMs: 2000,
  voiceInterrupt: false,
};
