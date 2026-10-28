import { expect, it } from 'bun:test';
import { activitySummary, buildActivityGrid, heatLevel, weeksThatFit } from './index';

const SATURDAY = new Date(2026, 9, 10, 15, 30);

it('shows 26 Monday-first weeks ending with the current one', () => {
  const grid = buildActivityGrid([], SATURDAY);
  expect(grid.weeks).toHaveLength(26);
  expect(grid.weeks[0]?.cells[0]?.date).toBe('2026-04-13');
  const lastWeek = grid.weeks[25]?.cells ?? [];
  expect(lastWeek.map((cell) => cell.date)).toEqual([
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
  ]);
});

it('marks today and leaves the days after it upcoming', () => {
  const lastWeek = buildActivityGrid([], SATURDAY).weeks[25]?.cells ?? [];
  expect(lastWeek.filter((cell) => cell.isToday).map((cell) => cell.date)).toEqual(['2026-10-10']);
  expect(lastWeek.map((cell) => cell.isUpcoming)).toEqual([
    false,
    false,
    false,
    false,
    false,
    false,
    true,
  ]);
});

it('labels a month at its first visible week only', () => {
  const labels = buildActivityGrid([], SATURDAY).weeks.map((week) => week.monthLabel);
  expect(labels[0]).toBe('Apr');
  expect(labels.filter((label) => label !== '')).toEqual([
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
  ]);
});

it('totals the minutes and days spoken across the grid', () => {
  const grid = buildActivityGrid(
    [
      { date: '2026-10-09', minutes: 9 },
      { date: '2026-10-10', minutes: 12 },
      { date: '2026-06-01', minutes: 30 },
    ],
    SATURDAY,
  );
  expect(grid.totalMinutes).toBe(51);
  expect(grid.spokenDays).toBe(3);
  expect(grid.thisWeekMinutes).toBe(21);
  expect(grid.thisWeekSpokenDays).toBe(2);
});

it('ignores recorded days outside the grid and after today', () => {
  const grid = buildActivityGrid(
    [
      { date: '2025-01-01', minutes: 40 },
      { date: '2026-10-11', minutes: 40 },
    ],
    SATURDAY,
  );
  expect(grid.totalMinutes).toBe(0);
});

it('draws one bar per weekday and highlights today', () => {
  const bars = buildActivityGrid([{ date: '2026-10-10', minutes: 10 }], SATURDAY).thisWeekBars;
  expect(bars.map((bar) => bar.letter).join('')).toBe('MTWTFSS');
  expect(bars[5]?.tone).toBe('strong');
  expect(bars[0]?.tone).toBe('empty');
  expect(bars[0]?.heightPx).toBe(4);
});

it('groups minutes into five levels', () => {
  expect([0, 1, 5, 6, 10, 11, 20, 21].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
});

it('keeps Sunday in the week that started on the Monday before it', () => {
  const sunday = new Date(2026, 9, 11, 9);
  const lastWeek = buildActivityGrid([], sunday).weeks[25]?.cells ?? [];
  expect(lastWeek[0]?.date).toBe('2026-10-05');
  expect(lastWeek[6]?.isToday).toBe(true);
});

it('summarises the months without pressure and without zero counts', () => {
  expect(activitySummary(buildActivityGrid([], SATURDAY))).toBe(
    'Your speaking days will appear here after your first conversation.',
  );
  expect(activitySummary(buildActivityGrid([{ date: '2026-10-10', minutes: 12 }], SATURDAY))).toBe(
    '12 min in the last 26 weeks · 1 day you spoke',
  );
  expect(
    activitySummary(
      buildActivityGrid(
        [
          { date: '2026-10-09', minutes: 9 },
          { date: '2026-10-10', minutes: 12 },
        ],
        SATURDAY,
      ),
    ),
  ).toBe('21 min in the last 26 weeks · 2 days you spoke');
});

it('fits whole weeks into the width, between the minimum and the full range', () => {
  expect(weeksThatFit(0)).toBe(8);
  expect(weeksThatFit(100)).toBe(8);
  expect(weeksThatFit(21)).toBe(8);
  expect(weeksThatFit(18 * 12 + 4 * 11)).toBe(12);
  expect(weeksThatFit(18 * 12 + 4 * 11 + 21)).toBe(12);
  expect(weeksThatFit(18 * 13 + 4 * 12)).toBe(13);
  expect(weeksThatFit(5000)).toBe(26);
});

it('shows the last N weeks ending with the current one and counts only those', () => {
  const days = [
    { date: '2026-10-10', minutes: 12 },
    { date: '2026-08-20', minutes: 30 },
    { date: '2026-06-01', minutes: 50 },
  ];
  const grid = buildActivityGrid(days, SATURDAY, 10);
  expect(grid.weeks).toHaveLength(10);
  expect(grid.weeks[0]?.cells[0]?.date).toBe('2026-08-03');
  expect(grid.weeks[9]?.cells[0]?.date).toBe('2026-10-05');
  expect(grid.totalMinutes).toBe(42);
  expect(grid.spokenDays).toBe(2);
  expect(activitySummary(grid)).toBe('42 min in the last 10 weeks · 2 days you spoke');
});
