import { invoke } from '@tauri-apps/api/core';

export type ConversationProviderId = 'gemini' | 'apple' | 'agy';

export type AgyModelId = 'default' | 'gemini-3.8-flash-low' | 'gemini-3.8-flash-high';

export type AiSettings = {
  provider: ConversationProviderId;
  agy_model: AgyModelId;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'gemini',
  agy_model: 'default',
};

export function isConversationProviderId(value: unknown): value is ConversationProviderId {
  return value === 'gemini' || value === 'apple' || value === 'agy';
}

export function isAgyModelId(value: unknown): value is AgyModelId {
  return (
    value === 'default' || value === 'gemini-3.8-flash-low' || value === 'gemini-3.8-flash-high'
  );
}

export function isAiSettings(value: unknown): value is AiSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return (
    'provider' in value &&
    isConversationProviderId(value.provider) &&
    'agy_model' in value &&
    isAgyModelId(value.agy_model)
  );
}

export async function getAiSettings(): Promise<AiSettings> {
  const result: unknown = await invoke<unknown>('get_ai_settings');
  if (!isAiSettings(result)) {
    throw new Error('Unexpected AI settings response from backend.');
  }
  return result;
}

export async function saveAiSettings(settings: AiSettings): Promise<AiSettings> {
  const result: unknown = await invoke<unknown>('save_ai_settings', { settings });
  if (!isAiSettings(result)) {
    throw new Error('Unexpected save AI settings response from backend.');
  }
  return result;
}

/** Starts the saved provider ahead of the first answer; a no-op for Antigravity. */
export async function prewarmConversationProvider(): Promise<void> {
  await invoke<void>('prewarm_conversation_provider');
}
