import { describe, expect, it } from 'bun:test';
import { remainingPlanningSeconds } from './index';

describe('planning timer deadline', () => {
  it('counts down to zero at the deadline without extending fractional seconds', () => {
    expect(remainingPlanningSeconds(1_000, 1_000, 15)).toBe(15);
    expect(remainingPlanningSeconds(1_000, 2_001, 15)).toBe(14);
    expect(remainingPlanningSeconds(1_000, 16_000, 15)).toBe(0);
    expect(remainingPlanningSeconds(1_000, 20_000, 15)).toBe(0);
  });
});
