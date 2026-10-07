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
  it('shows progress against the target', () => {
    expect(resumeDetail({ mode: 'conversation', turnCount: 3, targetTurns: 8 })).toBe(
      '3 of 8 answers so far',
    );
  });

  it('names coach mode', () => {
    expect(resumeDetail({ mode: 'coach', turnCount: 0, targetTurns: 6 })).toBe(
      'Coach mode · 0 of 6 answers so far',
    );
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
