import { describe, expect, it } from 'bun:test';
import type { EvaGrowthSnapshot } from '../../types';
import { isNapping, toEvaStage, visibleStage } from './index';

const growth: EvaGrowthSnapshot = {
  drops: 45,
  stage: 2,
  stage_floor: 30,
  next_threshold: 60,
  napping: true,
  today: { speaking: [], sunshine: [] },
};

describe('eva stage', () => {
  it('maps the stage number to Eva stages and caps at full bloom', () => {
    expect(toEvaStage(0)).toBe(0);
    expect(toEvaStage(5)).toBe(5);
    expect(toEvaStage(9)).toBe(5);
  });

  it('shows the real stage while growth is shown', () => {
    expect(visibleStage(growth, true)).toBe(2);
  });

  it('shows no plant when growth is hidden or not loaded yet', () => {
    expect(visibleStage(growth, false)).toBeNull();
    expect(visibleStage(null, true)).toBeNull();
  });

  it('naps only while growth is shown', () => {
    expect(isNapping(growth, true)).toBe(true);
    expect(isNapping(growth, false)).toBe(false);
    expect(isNapping(null, true)).toBe(false);
  });
});
