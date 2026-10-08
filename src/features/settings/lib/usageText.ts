/** "4 h 44 min", "12 min" or "under a minute": how long until a limit resets. */
export function formatRemaining(remainingMs: number): string {
  const minutes = Math.floor(Math.max(0, remainingMs) / 60_000);
  if (minutes < 1) return 'under a minute';
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function requestsLabel(count: number): string {
  return count === 1 ? '1 request' : `${count} requests`;
}

/** What to say about an Antigravity quota error: when it comes back, or that it has. */
export function quotaResetText(resetsAtMs: number | null, nowMs: number): string {
  if (resetsAtMs === null) return 'Antigravity did not say when it resets.';
  if (resetsAtMs <= nowMs) return 'The quota should be back by now.';
  return `Resets in ${formatRemaining(resetsAtMs - nowMs)}.`;
}
