export const JOIN_WINDOW_MS = 4000;

export function isJoinWindowOpen(openedAtMs: number, nowMs: number): boolean {
  return nowMs - openedAtMs < JOIN_WINDOW_MS;
}

export function joinAnswers(previous: string, continuation: string): string {
  return `${previous.trim()} ${continuation.trim()}`;
}
