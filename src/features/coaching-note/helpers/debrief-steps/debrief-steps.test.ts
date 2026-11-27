import { describe, expect, it } from 'bun:test';
import { isSummary, nextLabel, nextStep, previousStep, progressLabel } from '.';

describe('debrief steps', () => {
  it('walks the cards in order and then rests on the summary', () => {
    expect(nextStep(0, 3)).toBe(1);
    expect(nextStep(2, 3)).toBe(3);
    expect(nextStep(3, 3)).toBe(3);
    expect(isSummary(2, 3)).toBe(false);
    expect(isSummary(3, 3)).toBe(true);
  });

  it('never goes before the first card', () => {
    expect(previousStep(2)).toBe(1);
    expect(previousStep(0)).toBe(0);
  });

  it('labels the progress from one and the last card ends the walk', () => {
    expect(progressLabel(0, 8)).toBe('1 / 8');
    expect(progressLabel(2, 8)).toBe('3 / 8');
    expect(nextLabel(6, 8)).toBe('Next');
    expect(nextLabel(7, 8)).toBe('Finish');
  });
});
