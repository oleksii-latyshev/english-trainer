export function remainingPlanningSeconds(
  startedAtMs: number,
  nowMs: number,
  durationSeconds: number,
): number {
  return Math.max(0, Math.ceil((startedAtMs + durationSeconds * 1000 - nowMs) / 1000));
}
