/** The visible edit window between a voice transcript appearing and it being sent. */
export type SendCountdown = { text: string; deadlineMs: number };

export function startSendCountdown(text: string, nowMs: number, delayMs: number): SendCountdown {
  return { text, deadlineMs: nowMs + Math.max(0, delayMs) };
}

export function countdownRemainingMs(countdown: SendCountdown, nowMs: number): number {
  return Math.max(0, countdown.deadlineMs - nowMs);
}

export function isCountdownDue(countdown: SendCountdown, nowMs: number): boolean {
  return countdownRemainingMs(countdown, nowMs) === 0;
}

/** Editing the text, or anything but the original transcript, stops the countdown. */
export function isCountdownEdited(countdown: SendCountdown, draft: string): boolean {
  return draft !== countdown.text;
}

export function countdownLabel(remainingMs: number): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return `Sending in ${seconds} s — edit to stop`;
}

/** A zero delay sends at once; otherwise the transcript waits in the edit window. */
export function autoSendAction(delayMs: number): 'send-now' | 'countdown' {
  return delayMs <= 0 ? 'send-now' : 'countdown';
}
