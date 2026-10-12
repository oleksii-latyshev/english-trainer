const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;

export function formatRemaining(remainingMs: number): string {
  const minutes = Math.floor(Math.max(0, remainingMs) / MINUTE_MS);
  if (minutes < 1) return 'under a minute';
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours === 0) return `${minutes} min`;
  const rest = minutes % MINUTES_PER_HOUR;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function quotaResetText(resetsAtMs: number | null, nowMs: number): string {
  if (resetsAtMs === null) return 'Antigravity did not say when it resets.';
  if (resetsAtMs <= nowMs) return 'The quota should be back by now.';
  return `Resets in ${formatRemaining(resetsAtMs - nowMs)}.`;
}

export function dailyCountResetText(resetsAtMs: number, nowMs: number): string {
  return `Counted by this app. The daily count starts over at midnight Pacific time, in ${formatRemaining(resetsAtMs - nowMs)}.`;
}
