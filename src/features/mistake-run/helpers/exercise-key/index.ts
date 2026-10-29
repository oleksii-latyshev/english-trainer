export function exerciseKey(runId: number, position: number): string {
  return `${runId}:${position}`;
}
