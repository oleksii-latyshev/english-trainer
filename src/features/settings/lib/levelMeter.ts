/** How many of `barCount` meter bars are lit for a 0–1 input level (already on the dB-based meter scale). */
export function litBars(level: number | undefined, barCount: number): number {
  if (level === undefined || !Number.isFinite(level) || level <= 0) return 0;
  return Math.min(barCount, Math.round(Math.min(1, level) * barCount));
}

/** Seconds for the provider test, as the design shows them: "0.62 s" for first words, "1.4 s" for the full reply. */
export function formatSeconds(ms: number, decimals: 1 | 2): string {
  return `${(ms / 1000).toFixed(decimals)} s`;
}
