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

export function isCountdownEdited(countdown: SendCountdown, draft: string): boolean {
  return draft !== countdown.text;
}

export function countdownLabel(remainingMs: number): string {
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  return `Sending in ${seconds} s — edit to stop`;
}

export function autoSendAction(delayMs: number): 'send-now' | 'countdown' {
  return delayMs <= 0 ? 'send-now' : 'countdown';
}
