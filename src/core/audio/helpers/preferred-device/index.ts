import { Schema, SchemaGetter } from 'effect';
import type { StorageStatus } from '../../audio';

export const PREFERRED_MICROPHONE_KEY = 'english_trainer_preferred_microphone_id';

export function parsePreferredDeviceId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed === 'default') return '';
  return trimmed;
}

export const PreferredDeviceSchema = Schema.Unknown.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform(parsePreferredDeviceId),
    encode: SchemaGetter.passthrough(),
  }),
);

function isJsonString(raw: string): boolean {
  return raw.startsWith('"');
}

function readAsJson(raw: string | null): string | null {
  if (raw === null) return null;
  return isJsonString(raw) ? raw : JSON.stringify(raw);
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function legacyDeviceStorage(storage: StorageLike): Storage {
  return {
    getItem: (key) => readAsJson(storage.getItem(key)),
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: (key) => storage.removeItem(key),
    clear: () => undefined,
    key: () => null,
    length: 0,
  };
}

const STORAGE_UNAVAILABLE_WARNING =
  'Local storage is unavailable; device selection will only apply to the current session.';
const STORAGE_BLOCKED_WARNING =
  'Local storage access was blocked or unavailable. Device selection will apply to the current session only.';

export const STORAGE_AVAILABLE: StorageStatus = { available: true };
export const STORAGE_BLOCKED: StorageStatus = {
  available: false,
  warning: STORAGE_BLOCKED_WARNING,
};
export const STORAGE_MISSING: StorageStatus = {
  available: false,
  warning: STORAGE_UNAVAILABLE_WARNING,
};
