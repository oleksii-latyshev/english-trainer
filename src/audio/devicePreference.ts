import { useSyncExternalStore } from 'react';
import type { ActualAudioInput, StorageStatus } from './types';

export const PREFERRED_MICROPHONE_KEY = 'english_trainer_preferred_microphone_id';

export function parsePreferredDeviceId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed === 'default') return '';
  return trimmed;
}

export function readStoredDeviceId(): {
  deviceId: string;
  storageAvailable: boolean;
  warning?: string;
} {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        deviceId: '',
        storageAvailable: false,
        warning:
          'Local storage is unavailable; device selection will only apply to the current session.',
      };
    }
    const raw = window.localStorage.getItem(PREFERRED_MICROPHONE_KEY);
    return {
      deviceId: parsePreferredDeviceId(raw),
      storageAvailable: true,
    };
  } catch {
    return {
      deviceId: '',
      storageAvailable: false,
      warning:
        'Local storage access was blocked or unavailable. Device selection will apply to the current session only.',
    };
  }
}

export function writeStoredDeviceId(id: string): StorageStatus {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        available: false,
        warning:
          'Local storage is unavailable; device selection will only apply to the current session.',
      };
    }
    if (id) {
      window.localStorage.setItem(PREFERRED_MICROPHONE_KEY, id);
    } else {
      window.localStorage.removeItem(PREFERRED_MICROPHONE_KEY);
    }
    return { available: true };
  } catch {
    return {
      available: false,
      warning:
        'Local storage is unavailable; device selection will only apply to the current session.',
    };
  }
}

const initial = readStoredDeviceId();
let currentDeviceId = initial.deviceId;
let currentStorageStatus: StorageStatus = {
  available: initial.storageAvailable,
  warning: initial.warning,
};
let currentActualInput: ActualAudioInput | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function getPreferredDeviceId(): string {
  return currentDeviceId;
}

export function setPreferredDeviceId(id: string): void {
  const parsed = parsePreferredDeviceId(id);
  currentDeviceId = parsed;
  currentStorageStatus = writeStoredDeviceId(parsed);
  notifyListeners();
}

export function getStorageStatus(): StorageStatus {
  return currentStorageStatus;
}

export function getLastActualAudioInput(): ActualAudioInput | null {
  return currentActualInput;
}

export function recordActualAudioInput(input: ActualAudioInput): void {
  currentActualInput = input;
  notifyListeners();
}

export function subscribeDevicePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePreferredMicrophone() {
  const selectedDeviceId = useSyncExternalStore(
    subscribeDevicePreference,
    getPreferredDeviceId,
    () => '',
  );
  const storageStatus = useSyncExternalStore(
    subscribeDevicePreference,
    getStorageStatus,
    () => currentStorageStatus,
  );
  const actualInput = useSyncExternalStore(
    subscribeDevicePreference,
    getLastActualAudioInput,
    () => null,
  );

  return {
    selectedDeviceId,
    selectDevice: setPreferredDeviceId,
    storageStatus,
    actualInput,
  };
}
