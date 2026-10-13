export function litBars(level: number | undefined, barCount: number): number {
  if (level === undefined || !Number.isFinite(level) || level <= 0) return 0;
  return Math.min(barCount, Math.round(Math.min(1, level) * barCount));
}
