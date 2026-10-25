import type { Trend } from '../../types';

export type TrendLine = {
  text: string;
  tone: 'positive' | 'quiet';
};

function signed(change: number): string {
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}

function toneOf(change: number): TrendLine['tone'] {
  return change > 0 ? 'positive' : 'quiet';
}

export function trendLine(trend: Trend): TrendLine {
  switch (trend.kind) {
    case 'first':
      return { text: 'first session with this measure', tone: 'quiet' };
    case 'same':
      return { text: 'about the same as usual', tone: 'quiet' };
    case 'percent':
      return { text: `${signed(trend.change)}% vs last session`, tone: toneOf(trend.change) };
    case 'words':
      return {
        text: `${signed(trend.change)} ${Math.abs(trend.change) === 1 ? 'word' : 'words'} vs last session`,
        tone: toneOf(trend.change),
      };
  }
}
