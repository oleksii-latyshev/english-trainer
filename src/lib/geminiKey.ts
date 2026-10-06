import { invoke } from '@tauri-apps/api/core';

export type GeminiKeySource = 'settings' | 'environment';

export type GeminiKeyStatus =
  | { configured: false; source: null }
  | { configured: true; source: GeminiKeySource };

export function isGeminiKeyStatus(value: unknown): value is GeminiKeyStatus {
  if (typeof value !== 'object' || value === null) return false;
  if (!('configured' in value) || !('source' in value)) return false;
  if (value.configured === false) return value.source === null;
  return (
    value.configured === true && (value.source === 'settings' || value.source === 'environment')
  );
}

export async function getGeminiKeyStatus(): Promise<GeminiKeyStatus> {
  const result: unknown = await invoke<unknown>('get_gemini_key_status');
  if (!isGeminiKeyStatus(result)) throw new Error('Unexpected Gemini key status response.');
  return result;
}

export async function saveGeminiApiKey(key: string): Promise<void> {
  await invoke<void>('save_gemini_api_key', { key });
}

export async function deleteGeminiApiKey(): Promise<void> {
  await invoke<void>('delete_gemini_api_key');
}
