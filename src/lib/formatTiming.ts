export function formatTiming(value?: number): string {
  return value === undefined ? '—' : `${Math.round(value)} ms`;
}
