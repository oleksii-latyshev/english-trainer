import type { SpeakingActivitySchema } from '@/core/ipc';

type SpeakingDay = (typeof SpeakingActivitySchema.Type)['days'][number];

const WEEKS_SHOWN = 26;
const DAYS_IN_WEEK = 7;
const LEVEL_LIMITS = [0, 5, 10, 20] as const;
const WEEKDAYS = [
  { id: 'mon', letter: 'M', rowLabel: 'Mon' },
  { id: 'tue', letter: 'T', rowLabel: '' },
  { id: 'wed', letter: 'W', rowLabel: 'Wed' },
  { id: 'thu', letter: 'T', rowLabel: '' },
  { id: 'fri', letter: 'F', rowLabel: 'Fri' },
  { id: 'sat', letter: 'S', rowLabel: '' },
  { id: 'sun', letter: 'S', rowLabel: 'Sun' },
] as const;
export const WEEKDAY_ROWS = WEEKDAYS.map(({ id, rowLabel }) => ({ id, label: rowLabel }));
const MAX_BAR_PX = 54;
const MIN_BAR_PX = 4;
const BAR_SCALE_MINUTES = 20;

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

type GridCell = {
  readonly date: string;
  readonly minutes: number;
  readonly level: HeatLevel;
  readonly isToday: boolean;
  readonly isUpcoming: boolean;
  readonly label: string;
};

type GridWeek = { readonly monthLabel: string; readonly cells: readonly GridCell[] };

type WeekBar = {
  readonly id: string;
  readonly letter: string;
  readonly minutes: number;
  readonly heightPx: number;
  readonly tone: 'empty' | 'soft' | 'strong';
};

export type ActivityGrid = {
  readonly weeks: readonly GridWeek[];
  readonly totalMinutes: number;
  readonly spokenDays: number;
  readonly thisWeekMinutes: number;
  readonly thisWeekSpokenDays: number;
  readonly thisWeekBars: readonly WeekBar[];
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function mondayOf(date: Date): Date {
  const sinceMonday = (date.getDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;
  return addDays(date, -sinceMonday);
}

export function heatLevel(minutes: number): HeatLevel {
  if (minutes <= LEVEL_LIMITS[0]) return 0;
  if (minutes <= LEVEL_LIMITS[1]) return 1;
  if (minutes <= LEVEL_LIMITS[2]) return 2;
  if (minutes <= LEVEL_LIMITS[3]) return 3;
  return 4;
}

function dayLabel(date: Date, minutes: number): string {
  const name = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return minutes > 0 ? `${name} · ${minutes} min` : name;
}

function buildCell(date: Date, today: Date, minutesByDate: ReadonlyMap<string, number>): GridCell {
  const key = dateKey(date);
  const isUpcoming = date.getTime() > today.getTime();
  const minutes = isUpcoming ? 0 : (minutesByDate.get(key) ?? 0);
  return {
    date: key,
    minutes,
    level: heatLevel(minutes),
    isToday: key === dateKey(today),
    isUpcoming,
    label: dayLabel(date, minutes),
  };
}

function barTone(cell: GridCell): WeekBar['tone'] {
  if (cell.minutes === 0) return 'empty';
  return cell.isToday ? 'strong' : 'soft';
}

function weekBars(cells: readonly GridCell[]): readonly WeekBar[] {
  const scale = Math.max(BAR_SCALE_MINUTES, ...cells.map((cell) => cell.minutes));
  return cells.map((cell, index) => ({
    id: WEEKDAYS[index]?.id ?? cell.date,
    letter: WEEKDAYS[index]?.letter ?? '',
    minutes: cell.minutes,
    heightPx: Math.max(MIN_BAR_PX, Math.round((cell.minutes / scale) * MAX_BAR_PX)),
    tone: barTone(cell),
  }));
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function buildActivityGrid(days: readonly SpeakingDay[], now: Date): ActivityGrid {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const minutesByDate = new Map(days.map((day) => [day.date, day.minutes]));
  const firstMonday = addDays(mondayOf(today), -(WEEKS_SHOWN - 1) * DAYS_IN_WEEK);
  let previousMonth = -1;
  const weeks: GridWeek[] = Array.from({ length: WEEKS_SHOWN }, (_, weekIndex) => {
    const monday = addDays(firstMonday, weekIndex * DAYS_IN_WEEK);
    const monthLabel =
      monday.getMonth() === previousMonth
        ? ''
        : monday.toLocaleDateString('en-US', { month: 'short' });
    previousMonth = monday.getMonth();
    const cells = Array.from({ length: DAYS_IN_WEEK }, (_, dayIndex) =>
      buildCell(addDays(monday, dayIndex), today, minutesByDate),
    );
    return { monthLabel, cells };
  });
  const allCells = weeks.flatMap((week) => week.cells);
  const currentWeek = weeks[WEEKS_SHOWN - 1]?.cells ?? [];
  return {
    weeks,
    totalMinutes: sum(allCells.map((cell) => cell.minutes)),
    spokenDays: allCells.filter((cell) => cell.minutes > 0).length,
    thisWeekMinutes: sum(currentWeek.map((cell) => cell.minutes)),
    thisWeekSpokenDays: currentWeek.filter((cell) => cell.minutes > 0).length,
    thisWeekBars: weekBars(currentWeek),
  };
}

export function activitySummary(grid: ActivityGrid): string {
  if (grid.spokenDays === 0) {
    return 'Your speaking days will appear here after your first conversation.';
  }
  const days = grid.spokenDays === 1 ? 'day' : 'days';
  return `${grid.totalMinutes} min in 6 months · ${grid.spokenDays} ${days} you spoke`;
}
