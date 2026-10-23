import { describe, expect, it } from 'bun:test';
import type { SessionDetails } from '@/core/practice-session';
import { elapsedSessionMs, formatElapsedClock, mistakePracticeProgress, sessionProgress } from '.';

const SESSION: SessionDetails = {
  sessionId: 1,
  question: 'Q?',
  turnCount: 0,
  targetTurns: 8,
  retryEvidence: [],
  topicId: 'daily_life',
  topicLabel: 'Daily life',
  topicCustom: null,
  durationGoalSeconds: 600,
  activeDurationMs: 0,
  startedAt: 1,
  isClockRunning: false,
  clockSnapshotAtMs: 0,
  practiceMode: 'voice',
  practicePhase: 'speaking',
  writtenTurnCount: 0,
  spokenTurnCount: 0,
  isMistakePractice: false,
};

describe('usual-mistake practice progress', () => {
  it('names the current question and approximate length', () => {
    expect(mistakePracticeProgress(0, 5)).toEqual({
      label: 'Question 1 of 5 · About 2 minutes',
      value: 1,
      percent: 20,
      isComplete: false,
    });
  });

  it('ends at five and reports completion without another question', () => {
    expect(mistakePracticeProgress(5, 5)).toEqual({
      label: 'Practice complete',
      value: 5,
      percent: 100,
      isComplete: true,
    });
  });
});

describe('the session clock', () => {
  it('formats minutes and seconds', () => {
    expect(formatElapsedClock(372_000)).toBe('06:12');
    expect(formatElapsedClock(3_600_000)).toBe('60:00');
  });

  it('adds the time since the snapshot only while the clock runs', () => {
    expect(elapsedSessionMs(30_000, 1000, true, 6000)).toBe(35_000);
    expect(elapsedSessionMs(30_000, 1000, false, 6000)).toBe(30_000);
    expect(elapsedSessionMs(30_000, 6000, true, 1000)).toBe(30_000);
  });
});

describe('session progress', () => {
  it('reads elapsed time against the suggested length and the mode', () => {
    expect(sessionProgress(SESSION, 62_000)).toMatchObject({
      label: '01:02 of 10:00 · Speak',
      value: 62,
      max: 600,
    });
  });

  it('caps the bar at the suggested length', () => {
    expect(sessionProgress(SESSION, 900_000).percent).toBe(100);
  });

  it('adds the stage and the spoken count for write then speak', () => {
    const rehearsal = {
      ...SESSION,
      practiceMode: 'write_then_speak' as const,
      practicePhase: 'speaking' as const,
      writtenTurnCount: 3,
      spokenTurnCount: 1,
    };
    expect(sessionProgress(rehearsal, 0).label).toBe(
      '00:00 of 10:00 · Write, then speak · Speaking · 1 of 3',
    );
    expect(sessionProgress({ ...rehearsal, practicePhase: 'writing' }, 0).label).toContain(
      '· Writing',
    );
  });

  it('counts questions in a mistake drill', () => {
    const drill = { ...SESSION, isMistakePractice: true, targetTurns: 5, turnCount: 2 };
    expect(sessionProgress(drill, 0)).toMatchObject({
      label: 'Question 3 of 5 · About 2 minutes',
      max: 5,
    });
  });
});
