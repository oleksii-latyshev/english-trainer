import { useSyncExternalStore } from 'react';

export type LocalPreference<T> = {
  get: () => T;
  set: (patch: Partial<T>) => void;
  subscribe: (listener: () => void) => () => void;
  use: () => readonly [T, (patch: Partial<T>) => void];
};

function readJson(key: string): unknown {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    // Storage blocked or the stored text is not JSON: the defaults apply.
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the choice still applies until the app closes.
  }
}

/**
 * A pure UI preference kept in localStorage, parsed field by field on every read and write.
 * `parse` receives `unknown` (the stored JSON, or undefined) and must always return a valid value.
 */
export function createLocalPreference<T extends object>(
  key: string,
  parse: (raw: unknown) => T,
): LocalPreference<T> {
  let current = parse(readJson(key));
  const listeners = new Set<() => void>();
  const get = () => current;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const set = (patch: Partial<T>) => {
    current = parse({ ...current, ...patch });
    writeJson(key, current);
    for (const listener of [...listeners]) listener();
  };
  const defaults = parse(undefined);
  const use = () => [useSyncExternalStore(subscribe, get, () => defaults), set] as const;
  return { get, set, subscribe, use };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
