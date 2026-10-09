import { describe, expect, it } from 'bun:test';
import {
  advancePractice,
  recordRetryComparison,
  setTurnPending,
  updatePracticeClock,
  updateSummary,
} from './practiceState';

describe('practice prompt progression', () => {
  const active = {
    tag: 'active',
    sessionId: 7,
    question: 'How was your day?',
    turnCount: 1,
    targetTurns: 8,
    retryEvidence: [],
    topicId: 'daily_life',
    topicLabel: 'Daily life',
    topicCustom: null,
    durationGoalSeconds: 600,
    activeDurationMs: 42000,
    startedAt: 1780000000000,
    isClockRunning: true,
    isMistakePractice: false,
    clockSnapshotAtMs: 2000,
  };
  const turn = {
    spoken_reply: 'That sounds interesting.',
    question: 'What happened next?',
    session_phase: 'active',
    is_complete: false,
  };

  it('shows the next question after a successful turn', () => {
    expect(advancePractice(active, 7, turn)).toEqual({
      ...active,
      question: 'What happened next?',
      turnCount: 2,
    });
  });

  it('preserves F12 identity and keeps its completion prompt after the final answer', () => {
    const drill = {
      ...active,
      isMistakePractice: true,
      turnCount: 4,
      targetTurns: 5,
    };
    expect(advancePractice(drill, 7, { ...turn, question: null, is_complete: true })).toMatchObject(
      {
        question: 'That sounds interesting.',
        turnCount: 5,
        isMistakePractice: true,
      },
    );
  });

  it('derives written and spoken counts as answers are accepted in each stage', () => {
    const writing = {
      ...active,
      turnCount: 0,
      practiceMode: 'write_then_speak',
      practicePhase: 'writing',
      writtenTurnCount: 0,
      spokenTurnCount: 0,
    };
    const afterWriting = advancePractice(writing, 7, turn);
    expect(afterWriting).toMatchObject({ turnCount: 1, writtenTurnCount: 1, spokenTurnCount: 0 });
    const speaking = { ...afterWriting, practicePhase: 'speaking' };
    expect(advancePractice(speaking, 7, turn)).toMatchObject({
      turnCount: 2,
      writtenTurnCount: 1,
      spokenTurnCount: 1,
    });
  });

  it('ignores a reply from an older session', () => {
    expect(advancePractice(active, 6, turn)).toBe(active);
  });

  it('keeps the session waiting until the provider request settles', () => {
    const waiting = setTurnPending(active, true);
    expect(waiting.tag).toBe('waiting');
    expect(advancePractice(waiting, 7, turn)).toMatchObject({
      question: 'What happened next?',
    });
    expect(setTurnPending(waiting, false).tag).toBe('active');
  });

  it('shows a saved retry immediately without advancing the conversation', () => {
    const comparison = { turn_sequence: 1, retry_transcript: 'I work there now.' };
    const updated = recordRetryComparison(active, 7, comparison);
    expect(updated).toMatchObject({
      question: active.question,
      turnCount: active.turnCount,
      retryEvidence: [comparison],
    });
    expect(
      recordRetryComparison(updated, 7, { ...comparison, retry_transcript: 'I work there.' })
        .retryEvidence,
    ).toHaveLength(1);
    expect(recordRetryComparison(active, 6, comparison)).toBe(active);
  });

  it('replaces the wrap-up with a fuller one for the same session only', () => {
    const completed = { tag: 'completed', summary: { session_id: 7, phrases: [] } };
    const fuller = { session_id: 7, phrases: [{ phrase: 'I work there' }] };
    expect(updateSummary(completed, fuller)).toEqual({ tag: 'completed', summary: fuller });
    expect(updateSummary(completed, { ...fuller, session_id: 8 })).toBe(completed);
    expect(updateSummary(active, fuller)).toBe(active);
  });

  it('keeps topic and suggested time across replies and updates only clock fields from snapshots', () => {
    const next = {
      ...advancePractice(active, 7, turn),
      practiceMode: 'write_then_speak',
      practicePhase: 'writing',
      writtenTurnCount: 1,
      spokenTurnCount: 0,
    };
    expect(next).toMatchObject({
      topicId: 'daily_life',
      topicLabel: 'Daily life',
      durationGoalSeconds: 600,
      activeDurationMs: 42000,
    });
    const snapshot = {
      session_id: 7,
      topic_id: 'plans_stories',
      topic_label: 'Plans & stories',
      topic_custom: null,
      duration_goal_seconds: 900,
      active_duration_ms: 65000,
      started_at: 1780000000000,
      is_clock_running: false,
      practice_mode: 'write_then_speak',
      practice_phase: 'writing',
      written_turn_count: 0,
      spoken_turn_count: 0,
    };
    expect(updatePracticeClock(next, snapshot)).toMatchObject({
      question: 'What happened next?',
      turnCount: 2,
      writtenTurnCount: 1,
      spokenTurnCount: 0,
      practicePhase: 'writing',
      topicLabel: 'Plans & stories',
      activeDurationMs: 65000,
      isClockRunning: false,
    });
    expect(updatePracticeClock(next, { ...snapshot, session_id: 8 })).toBe(next);
  });
});
