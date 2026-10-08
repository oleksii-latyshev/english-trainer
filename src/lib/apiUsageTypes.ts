import { invoke } from '@tauri-apps/api/core';
import { isRecord } from './localPreference';

/** Mirrors `ApiUsageOverview` in Rust `api_usage/mod.rs`. */
export type LimitNote = {
  occurred_at_ms: number;
  model: string;
  message: string;
  resets_at_ms: number | null;
};

export type ModelRequests = { model: string; requests: number };

export type ApiUsageOverview = {
  /** The Pacific date the counts belong to, `YYYY-MM-DD`. */
  day: string;
  gemini: {
    models: ModelRequests[];
    /** Today's last rate-limit error. */
    last_limit: LimitNote | null;
    /** When today's count starts over: the next Pacific midnight. */
    resets_at_ms: number;
  };
  antigravity: {
    requests_today: number;
    /** The last quota error whatever its age; `resets_at_ms` says whether it still applies. */
    last_quota_error: LimitNote | null;
  };
};

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function isLimitNote(value: unknown): value is LimitNote {
  return (
    isRecord(value) &&
    isTimestamp(value.occurred_at_ms) &&
    typeof value.model === 'string' &&
    typeof value.message === 'string' &&
    (value.resets_at_ms === null || isTimestamp(value.resets_at_ms))
  );
}

function isOptionalLimitNote(value: unknown): value is LimitNote | null {
  return value === null || isLimitNote(value);
}

function isModelRequests(value: unknown): value is ModelRequests {
  return isRecord(value) && typeof value.model === 'string' && isCount(value.requests);
}

export function isApiUsageOverview(value: unknown): value is ApiUsageOverview {
  if (!isRecord(value) || typeof value.day !== 'string') return false;
  const { gemini, antigravity } = value;
  return (
    isRecord(gemini) &&
    Array.isArray(gemini.models) &&
    gemini.models.every(isModelRequests) &&
    isOptionalLimitNote(gemini.last_limit) &&
    isTimestamp(gemini.resets_at_ms) &&
    isRecord(antigravity) &&
    isCount(antigravity.requests_today) &&
    isOptionalLimitNote(antigravity.last_quota_error)
  );
}

export async function getApiUsage(): Promise<ApiUsageOverview> {
  const result: unknown = await invoke<unknown>('get_api_usage');
  if (!isApiUsageOverview(result)) {
    throw new Error('Unexpected usage response from backend.');
  }
  return result;
}
