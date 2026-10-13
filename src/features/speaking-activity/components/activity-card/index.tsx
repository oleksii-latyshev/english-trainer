import { useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { HeatCell } from '@/shared/ui/heat-cell';
import { Notice } from '@/shared/ui/notice';
import {
  type ActivityGrid,
  activitySummary,
  buildActivityGrid,
  WEEKDAY_ROWS,
} from '../../helpers/activity-grid';
import { speakingActivityAtom } from '../../model/atoms';
import type { SpeakingActivitySnapshot } from '../../types';

const LEGEND_LEVELS = [0, 1, 2, 3, 4] as const;

function Grid({ grid }: { grid: ActivityGrid }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <div aria-hidden="true" className="flex flex-col gap-1 pr-0.5">
        <span className="h-3.5" />
        {WEEKDAY_ROWS.map((row) => (
          <span className="h-4.5 text-faint text-pip leading-4.5" key={row.id}>
            {row.label}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        {grid.weeks.map((week) => (
          <div aria-hidden="true" className="flex flex-col gap-1" key={week.cells[0]?.date}>
            <span className="h-3.5 whitespace-nowrap text-faint text-pip leading-3.5">
              {week.monthLabel}
            </span>
            {week.cells.map((cell) => (
              <HeatCell
                key={cell.date}
                label={cell.label}
                level={cell.level}
                today={cell.isToday}
                upcoming={cell.isUpcoming}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityBody({ days }: { days: SpeakingActivitySnapshot['days'] }) {
  const grid = buildActivityGrid(days, new Date());
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-bold text-body">Speaking activity</h2>
        <span className="text-muted">{activitySummary(grid)}</span>
        <span className="ml-auto text-caption text-quiet-foreground">
          This week <b className="text-accent-text">{grid.thisWeekSpokenDays} of 7 days</b>
        </span>
      </div>
      <Grid grid={grid} />
      <div className="flex items-center gap-1.5 text-faint text-xs">
        <span>Less</span>
        {LEGEND_LEVELS.map((level) => (
          <HeatCell className="size-3" key={level} level={level} />
        ))}
        <span>More</span>
        <span className="ml-auto max-rail:hidden">
          Every square is a day · darker = more minutes spoken
        </span>
      </div>
    </>
  );
}

export function ActivityCard() {
  const result = useAtomValue(speakingActivityAtom);
  const retry = useAtomRefresh(speakingActivityAtom);
  const activity = Option.getOrNull(AsyncResult.value(result));

  return (
    <GlassPanel aria-label="Speaking activity" className="flex flex-col gap-3 px-5 py-4.5">
      {activity !== null && <ActivityBody days={activity.days} />}
      {activity === null && AsyncResult.isFailure(result) && (
        <Notice
          className="flex items-center gap-3 rounded-control border border-line"
          role="alert"
          tone="quiet"
        >
          <span className="flex-1">Your speaking activity could not be loaded.</span>
          <Button onClick={retry} size="sm" tone="secondary">
            Retry
          </Button>
        </Notice>
      )}
      {activity === null && !AsyncResult.isFailure(result) && (
        <Notice role="status" tone="quiet">
          Loading your speaking activity…
        </Notice>
      )}
    </GlassPanel>
  );
}
