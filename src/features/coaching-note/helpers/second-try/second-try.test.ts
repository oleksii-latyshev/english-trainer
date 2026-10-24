import { describe, expect, it } from 'bun:test';
import type { AttemptComparison } from '../../types';
import { secondTryHint, usedImprovedWording } from '.';

const comparison: AttemptComparison = {
  turn_sequence: 2,
  original_transcript: 'every bank send them',
  retry_transcript: 'every bank sends them',
  target: 'every bank sends',
  target_evidence: 'newly_observed_in_retry',
  word_count_change: 0,
  hesitation: 'Not measured from transcript text.',
};

describe('second try', () => {
  it('credits the improved wording only when it was heard', () => {
    expect(usedImprovedWording(comparison)).toBe(true);
    expect(usedImprovedWording({ ...comparison, target_evidence: 'already_present_in_both' })).toBe(
      true,
    );
    expect(usedImprovedWording({ ...comparison, target_evidence: 'not_observed' })).toBe(false);
    expect(usedImprovedWording({ ...comparison, target: '' })).toBe(false);
  });

  it('gives a calm hint when the wording was missing and none when unsure', () => {
    expect(secondTryHint({ ...comparison, target_evidence: 'not_observed' })).toBe(
      'Try “every bank sends” once more.',
    );
    expect(secondTryHint({ ...comparison, target_evidence: 'partially_observed' })).toContain(
      'Close',
    );
    expect(secondTryHint({ ...comparison, target_evidence: 'uncertain' })).toBe('');
    expect(secondTryHint(comparison)).toBe('');
  });
});
