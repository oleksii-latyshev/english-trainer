export function installFakeLocalStorage(initial: Record<string, string> = {}): Map<string, string> {
  const stored = new Map<string, string>(Object.entries(initial));
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
    clear: () => stored.clear(),
    key: () => null,
    length: 0,
  } satisfies Storage;
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    configurable: true,
    writable: true,
  });
  return stored;
}
