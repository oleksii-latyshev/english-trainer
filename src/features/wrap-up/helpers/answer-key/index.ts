export function answerKey(sessionId: number, sequence: number): string {
  return `${sessionId}:${sequence}`;
}
