// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { primaryAction, resumeDetail, reviewHint, reviewTitle } from './talkStartState';

describe('primaryAction', () => {
  it('prefers restoring over everything else', () => {
    expect(primaryAction({ isRestoring: true, isBusy: true, hasActiveSession: true })).toBe(
      'restoring',
    );
  });

  it('resumes an open session even while busy', () => {
    expect(primaryAction({ isRestoring: false, isBusy: true, hasActiveSession: true })).toBe(
      'resume',
    );
  });

  it('reports starting only when no session is open', () => {
    expect(primaryAction({ isRestoring: false, isBusy: true, hasActiveSession: false })).toBe(
      'starting',
    );
    expect(primaryAction({ isRestoring: false, isBusy: false, hasActiveSession: false })).toBe(
      'start',
    );
  });
});

describe('resumeDetail', () => {
  it('shows the open topic, start day and suggested time remaining', () => {
    const startedAt = new Date(2026, 9, 7, 9).getTime();
    const now = new Date(2026, 9, 7, 15).getTime();
    expect(
      resumeDetail(
        {
          topicLabel: 'Daily life',
          startedAt,
          durationGoalSeconds: 600,
          activeDurationMs: 8 * 60_000,
        },
        now,
      ),
    ).toBe('Daily life · Started today · 2 min left');
  });
});

describe('review copy', () => {
  it('shows the due count', () => {
    expect(reviewTitle(6)).toBe('Phrases to review today: 6');
  });

  it('stays calm when nothing is due', () => {
    expect(reviewTitle(0)).toBe('Nothing to review today');
    expect(reviewHint(0)).not.toBe(reviewHint(3));
  });
});
