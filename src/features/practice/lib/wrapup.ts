import type { Trend } from '@/lib/finishedPracticeSession';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

/** "10 min 24 s", "4 min", "24 s", "1 h 5 min": whole seconds, no leading zero units. */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR;
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  if (minutes === 0) return `${seconds} s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

export type TrendLine = {
  text: string;
  /** Growth is shown in the accent colour; everything else stays quiet. A drop is not a warning. */
  tone: 'positive' | 'quiet';
};

function signed(change: number): string {
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}

/** The line under a number: a personal trend against the last session, never a level. */
export function trendLine(trend: Trend): TrendLine {
  switch (trend.kind) {
    case 'first':
      return { text: 'first session with this measure', tone: 'quiet' };
    case 'same':
      return { text: 'about the same as usual', tone: 'quiet' };
    case 'percent':
      return {
        text: `${signed(trend.change)}% vs last session`,
        tone: trend.change > 0 ? 'positive' : 'quiet',
      };
    case 'words':
      return {
        text: `${signed(trend.change)} ${Math.abs(trend.change) === 1 ? 'word' : 'words'} vs last session`,
        tone: trend.change > 0 ? 'positive' : 'quiet',
      };
  }
}

/** The save button's label for the phrases still in the wrap-up. */
export function savePhrasesLabel(count: number): string {
  return count === 1 ? 'Save 1 phrase to Memory' : `Save all ${count} phrases to Memory`;
}

/**
 * The calm line while coaching of the last answers has not landed: they are still being checked,
 * or checking is paused. Empty when every answer is checked.
 */
export function checkingLine(pendingAnswers: number, isPaused: boolean): string {
  if (isPaused) {
    return 'Coaching is paused because Antigravity has no quota left. Unchecked answers are not included.';
  }
  if (pendingAnswers === 0) return '';
  return pendingAnswers === 1
    ? 'Still checking 1 answer…'
    : `Still checking ${pendingAnswers} answers…`;
}
