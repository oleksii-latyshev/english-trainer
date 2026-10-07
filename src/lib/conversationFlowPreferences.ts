import { useSyncExternalStore } from 'react';

export const CONVERSATION_FLOW_KEY = 'english_trainer_conversation_flow';

export type ConversationFlowPreferences = {
  autoListen: boolean;
  handsFree: boolean;
  endPauseMs: number;
  autoSendVoice: boolean;
  autoSendDelayMs: number;
};

export const END_PAUSE_RANGE_MS = { min: 1000, max: 3000 } as const;
export const AUTO_SEND_DELAY_RANGE_MS = { min: 0, max: 5000 } as const;

export const DEFAULT_CONVERSATION_FLOW: ConversationFlowPreferences = {
  autoListen: true,
  handsFree: true,
  endPauseMs: 1500,
  autoSendVoice: true,
  autoSendDelayMs: 2000,
};

/** Fully hands-free conversation sends at once: the edit window applies only when a hand is on the controls anyway. */
export function isFullyHandsFree(preferences: ConversationFlowPreferences): boolean {
  return preferences.autoListen && preferences.handsFree;
}

export function effectiveAutoSendDelayMs(preferences: ConversationFlowPreferences): number {
  return isFullyHandsFree(preferences) ? 0 : preferences.autoSendDelayMs;
}

export const END_PAUSE_CHOICES_MS = [1000, 1500, 2000, 3000] as const;
export const AUTO_SEND_CHOICES_MS = [1000, 2000, 3000] as const;

/** Settings shows auto-send as one choice: off, or the edit window in whole seconds. */
export type AutoSendChoice = 'off' | (typeof AUTO_SEND_CHOICES_MS)[number];

/** The choice matching the stored values, or undefined when the delay is not one Settings offers. */
export function autoSendChoice(
  preferences: ConversationFlowPreferences,
): AutoSendChoice | undefined {
  if (!preferences.autoSendVoice) return 'off';
  return AUTO_SEND_CHOICES_MS.find((choice) => choice === preferences.autoSendDelayMs);
}

export function autoSendPatch(choice: AutoSendChoice): Partial<ConversationFlowPreferences> {
  if (choice === 'off') return { autoSendVoice: false };
  return { autoSendVoice: true, autoSendDelayMs: choice };
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseMs(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts the stored JSON text or an already parsed value; anything invalid falls back per field. */
export function parseConversationFlow(raw: unknown): ConversationFlowPreferences {
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return DEFAULT_CONVERSATION_FLOW;
    }
  }
  if (!isRecord(value)) return DEFAULT_CONVERSATION_FLOW;
  const defaults = DEFAULT_CONVERSATION_FLOW;
  return {
    autoListen: parseBoolean(value.autoListen, defaults.autoListen),
    handsFree: parseBoolean(value.handsFree, defaults.handsFree),
    endPauseMs: parseMs(value.endPauseMs, END_PAUSE_RANGE_MS, defaults.endPauseMs),
    autoSendVoice: parseBoolean(value.autoSendVoice, defaults.autoSendVoice),
    autoSendDelayMs: parseMs(
      value.autoSendDelayMs,
      AUTO_SEND_DELAY_RANGE_MS,
      defaults.autoSendDelayMs,
    ),
  };
}

function readStored(): ConversationFlowPreferences {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_CONVERSATION_FLOW;
    return parseConversationFlow(window.localStorage.getItem(CONVERSATION_FLOW_KEY));
  } catch {
    // Storage blocked: the defaults apply for this session.
    return DEFAULT_CONVERSATION_FLOW;
  }
}

function writeStored(value: ConversationFlowPreferences): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(CONVERSATION_FLOW_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable: the choice still applies until the app closes.
  }
}

let current = readStored();
const listeners = new Set<() => void>();

export function getConversationFlow(): ConversationFlowPreferences {
  return current;
}

export function setConversationFlow(patch: Partial<ConversationFlowPreferences>): void {
  current = parseConversationFlow({ ...current, ...patch });
  writeStored(current);
  for (const listener of [...listeners]) listener();
}

export function subscribeConversationFlow(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConversationFlow() {
  const preferences = useSyncExternalStore(
    subscribeConversationFlow,
    getConversationFlow,
    () => DEFAULT_CONVERSATION_FLOW,
  );
  return { preferences, update: setConversationFlow };
}
