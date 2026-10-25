import { formatDuration } from '../../helpers/duration';
import { trendLine } from '../../helpers/trend-line';
import type { SessionNumbers, Trend } from '../../types';

type Props = {
  numbers: SessionNumbers;
};

const NO_VALUE = '—';

function StatCard(props: { label: string; value: string; trend: Trend; emptyHint: string }) {
  const line =
    props.value === NO_VALUE
      ? { text: props.emptyHint, tone: 'quiet' as const }
      : trendLine(props.trend);
  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-line bg-surface px-5 py-4.5">
      <div className="text-caption text-faint">{props.label}</div>
      <div className="font-semibold text-[28px]">{props.value}</div>
      <div
        className={line.tone === 'positive' ? 'text-caption text-me' : 'text-caption text-muted'}
      >
        {line.text}
      </div>
    </div>
  );
}

function wordsLabel(words: number): string {
  return `${words} ${words === 1 ? 'word' : 'words'}`;
}

export function WrapUpStats({ numbers }: Props) {
  const { speaking_time, words_per_minute, average_answer } = numbers;
  return (
    <div className="grid grid-cols-1 gap-3 min-[800px]:grid-cols-3">
      <StatCard
        emptyHint="no spoken answers to time"
        label="Speaking time"
        trend={speaking_time.trend}
        value={
          speaking_time.duration_ms === null ? NO_VALUE : formatDuration(speaking_time.duration_ms)
        }
      />
      <StatCard
        emptyHint="needs a spoken answer"
        label="Words per minute"
        trend={words_per_minute.trend}
        value={words_per_minute.value === null ? NO_VALUE : String(words_per_minute.value)}
      />
      <StatCard
        emptyHint="no answers yet"
        label="Average answer"
        trend={average_answer.trend}
        value={average_answer.words === null ? NO_VALUE : wordsLabel(average_answer.words)}
      />
    </div>
  );
}
