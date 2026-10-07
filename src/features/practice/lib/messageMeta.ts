/** Eva's reply time as the message meta shows it: one decimal, "0.8 s". */
export function formatReplyTime(replyMs: number | undefined): string | undefined {
  if (replyMs === undefined) return undefined;
  return `${(replyMs / 1000).toFixed(1)} s`;
}

/** A spoken answer's length as the message meta shows it: whole seconds, "14 s". */
export function formatAnswerDuration(durationMs: number | undefined): string | undefined {
  if (durationMs === undefined) return undefined;
  return `${Math.round(durationMs / 1000)} s`;
}

/** The spoken length to send with an answer: voice answers only, typed ones have none. */
export function spokenDurationMs(
  source: 'voice' | 'edited' | 'text' | undefined,
  recordingMs: number,
): number | undefined {
  if (source === undefined || source === 'text' || !(recordingMs > 0)) return undefined;
  return Math.round(recordingMs);
}
