import { describe, expect, it } from 'bun:test';
import { FIRST_RUN_STEPS } from '@/core/first-run';
import { stepCopy, stepLabel } from './index';

describe('step copy', () => {
  it('has a title and lead for every step', () => {
    for (const step of FIRST_RUN_STEPS) {
      expect(stepCopy(step.id).title.length).toBeGreaterThan(0);
      expect(stepCopy(step.id).lead.length).toBeGreaterThan(0);
    }
  });

  it('counts the steps out of the total', () => {
    expect(stepLabel('microphone')).toBe('Step 1 of 3');
    expect(stepLabel('voice')).toBe('Step 3 of 3');
  });
});
