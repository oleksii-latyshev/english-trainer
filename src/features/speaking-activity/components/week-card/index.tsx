import { useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Bar } from '@/shared/ui/bar';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { buildActivityGrid } from '../../helpers/activity-grid';
import { speakingActivityAtom } from '../../model/atoms';

export function WeekCard() {
  const result = useAtomValue(speakingActivityAtom);
  const activity = Option.getOrNull(AsyncResult.value(result));
  if (activity === null) return null;
  const grid = buildActivityGrid(activity.days, new Date());

  return (
    <GlassPanel aria-label="This week" className="flex flex-col gap-3 p-5">
      <h2 className="font-semibold text-caption text-faint">This week</h2>
      <div className="flex items-baseline gap-1.5">
        <span className="font-bold text-3xl tracking-tight">{grid.thisWeekMinutes}</span>
        <span className="text-muted">minutes spoken</span>
      </div>
      <div aria-hidden="true" className="flex items-end gap-2">
        {grid.thisWeekBars.map((bar) => (
          <div className="flex flex-1 flex-col items-center gap-1.5" key={bar.id}>
            <Bar heightPx={bar.heightPx} tone={bar.tone} />
            <span className="text-faint text-pip">{bar.letter}</span>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
