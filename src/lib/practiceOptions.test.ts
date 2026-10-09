// @ts-expect-error Bun provides this test module at runtime.
import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_PRACTICE_OPTIONS,
  elapsedSessionMs,
  formatElapsedClock,
  remainingMinutes,
  TOPICS,
  topicLabel,
} from './practiceOptions';

describe('practice topic and time options', () => {
  it('offers the supported topics and the ten minute default', () => {
    expect(TOPICS.map(({ id }) => id)).toContain('job_interview_technical');
    expect(TOPICS.map(({ id }) => id)).toContain('random');
    expect(DEFAULT_PRACTICE_OPTIONS.duration_goal_seconds).toBe(600);
  });

  it('uses the custom topic when available and preserves legacy labels', () => {
    expect(topicLabel('free_topic', '  A book I enjoyed  ')).toBe('A book I enjoyed');
    expect(topicLabel('free_conversation')).toBe('Free conversation');
    expect(topicLabel('job_interview_behavioural')).toBe('Job interview · behavioural');
  });

  it('formats elapsed time and computes a suggested remaining duration', () => {
    expect(formatElapsedClock(372_000)).toBe('06:12');
    expect(formatElapsedClock(3_600_000)).toBe('60:00');
    expect(remainingMinutes(600, 8 * 60_000)).toBe(2);
    expect(remainingMinutes(600, 11 * 60_000)).toBe(0);
  });

  it('extrapolates only while the Rust snapshot says the clock is running', () => {
    expect(elapsedSessionMs(30_000, 1000, true, 6000)).toBe(35_000);
    expect(elapsedSessionMs(30_000, 1000, false, 6000)).toBe(30_000);
    expect(elapsedSessionMs(30_000, 6000, true, 1000)).toBe(30_000);
  });
});
