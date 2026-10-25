const PAUSED_LINE =
  'Coaching is paused because Antigravity has no quota left. Unchecked answers are not included.';

export function checkingLine(pendingAnswers: number, isPaused: boolean): string {
  if (isPaused) return PAUSED_LINE;
  if (pendingAnswers === 0) return '';
  return pendingAnswers === 1
    ? 'Still checking 1 answer…'
    : `Still checking ${pendingAnswers} answers…`;
}
