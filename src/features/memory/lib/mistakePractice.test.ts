// @ts-expect-error Bun provides this test module at runtime.
import { describe, expect, it } from 'bun:test';
import type { MistakeRecord } from '@/lib/learningTypes';
import { eligibleMistakePracticeCount, isEligibleMistakePracticeTarget } from './mistakePractice';

function mistake(overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    id: 1,
    normalized_key: 'in the university',
    category: 'grammar',
    original_example: 'in the university',
    corrected_example: 'at university',
    explanation: 'Use at for the institution.',
    times_seen: 2,
    times_correct_afterwards: 0,
    last_seen_at: 10,
    last_reviewed_at: null,
    next_review_at: 99_999,
    interval_days: 1,
    ease_factor: 2.5,
    status: 'learning',
    is_due: false,
    ...overrides,
  };
}

describe('usual-mistake practice eligibility', () => {
  it('includes repeated mistakes regardless of their due date', () => {
    expect(isEligibleMistakePracticeTarget(mistake({ is_due: false }))).toBe(true);
    expect(eligibleMistakePracticeCount([mistake()])).toBe(1);
  });

  it('excludes first-seen, archived, and incomplete or overlong targets', () => {
    expect(isEligibleMistakePracticeTarget(mistake({ times_seen: 1 }))).toBe(false);
    expect(isEligibleMistakePracticeTarget(mistake({ status: 'archived' }))).toBe(false);
    expect(isEligibleMistakePracticeTarget(mistake({ explanation: ' ' }))).toBe(false);
    expect(isEligibleMistakePracticeTarget(mistake({ explanation: 'x'.repeat(501) }))).toBe(false);
    expect(isEligibleMistakePracticeTarget(mistake({ original_example: 'x'.repeat(301) }))).toBe(
      false,
    );
  });
});
