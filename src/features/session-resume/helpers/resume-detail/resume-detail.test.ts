import { expect, it } from 'bun:test';
import { resumeDetail } from './index';

it('shows the open topic, start day and suggested time remaining', () => {
  const startedAt = new Date(2026, 9, 7, 9).getTime();
  const now = new Date(2026, 9, 7, 15).getTime();
  expect(
    resumeDetail(
      { topicLabel: 'Daily life', startedAt, durationGoalSeconds: 600, activeDurationMs: 480_000 },
      now,
    ),
  ).toBe('Daily life · Started today · 2 min left');
});

it('says yesterday for a conversation started the day before', () => {
  const startedAt = new Date(2026, 9, 6, 22).getTime();
  const now = new Date(2026, 9, 7, 8).getTime();
  expect(
    resumeDetail(
      { topicLabel: 'Daily life', startedAt, durationGoalSeconds: 600, activeDurationMs: 0 },
      now,
    ),
  ).toBe('Daily life · Started yesterday · 10 min left');
});

it('never reports negative time once the suggested length is over', () => {
  expect(
    resumeDetail(
      { topicLabel: 'Plans', startedAt: 1, durationGoalSeconds: 300, activeDurationMs: 900_000 },
      1,
    ),
  ).toContain('0 min left');
});

it('reads minutes so far when the session has no time limit', () => {
  const session = {
    topicLabel: 'Daily life',
    startedAt: 1,
    durationGoalSeconds: null,
    activeDurationMs: 7 * 60_000 + 30_000,
  };
  expect(resumeDetail(session, 1)).toBe('Daily life · Started today · 7 min so far');
  expect(resumeDetail({ ...session, activeDurationMs: 0 }, 1)).toBe(
    'Daily life · Started today · less than a minute so far',
  );
});

it('shows remaining questions for a restored mistake practice', () => {
  const session = {
    topicLabel: 'Usual mistakes',
    startedAt: 1,
    durationGoalSeconds: 300,
    activeDurationMs: 60_000,
    isMistakePractice: true,
    turnCount: 2,
    targetTurns: 5,
  };
  expect(resumeDetail(session)).toBe('3 questions left');
  expect(resumeDetail({ ...session, turnCount: 4 })).toBe('1 question left');
});
