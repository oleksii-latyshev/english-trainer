import { describe, expect, it } from 'bun:test';
import type { EvaGrowthSnapshot } from '@/core/eva-growth';
import {
  dropsLabel,
  gainAmount,
  speakingGainLabel,
  stageProgress,
  stageStrip,
  sunshineGainLabel,
} from './index';

function growth(overrides: Partial<EvaGrowthSnapshot>): EvaGrowthSnapshot {
  return {
    drops: 101,
    stage: 3,
    stage_floor: 60,
    next_threshold: 100,
    napping: false,
    today: { speaking: [], sunshine: [] },
    ...overrides,
  };
}

describe('stage progress', () => {
  it('counts drops within the current stage', () => {
    const progress = stageProgress(
      growth({ drops: 101, stage: 4, stage_floor: 100, next_threshold: 150 }),
    );
    expect(progress.stageName).toBe('Bloom');
    expect(progress.counts).toBe('1 / 50 drops');
    expect(progress.footer).toBe('49 drops to Full bloom');
    expect(progress.summary).toBe('1 / 50 drops to Full bloom');
    expect([progress.value, progress.max]).toEqual([1, 50]);
  });

  it('names the next stage and counts what is left', () => {
    const progress = stageProgress(growth({ drops: 99 }));
    expect(progress.counts).toBe('39 / 40 drops');
    expect(progress.footer).toBe('1 drop to Bloom');
  });

  it('starts the seed at zero', () => {
    const progress = stageProgress(
      growth({ drops: 0, stage: 0, stage_floor: 0, next_threshold: 10 }),
    );
    expect(progress.counts).toBe('0 / 10 drops');
    expect(progress.footer).toBe('10 drops to Sprout');
  });

  it('reads "In full bloom" with a full bar and the total', () => {
    const progress = stageProgress(
      growth({ drops: 212, stage: 5, stage_floor: 150, next_threshold: null }),
    );
    expect(progress.footer).toBe('In full bloom');
    expect(progress.counts).toBe('212 drops');
    expect(progress.summary).toBe('In full bloom');
    expect(progress.isFullBloom).toBe(true);
    expect(progress.value).toBe(progress.max);
  });
});

describe('gain labels', () => {
  it('describes speaking and sunshine gains', () => {
    expect(gainAmount({ drops: 12 })).toBe('+12');
    expect(speakingGainLabel({ drops: 12, topic: 'Explaining a bug' })).toBe(
      '12 min about Explaining a bug',
    );
    expect(sunshineGainLabel({ phrase: 'most of' })).toBe('Said “most of” on your own');
  });

  it('pluralises drops', () => {
    expect(dropsLabel(1)).toBe('1 drop');
    expect(dropsLabel(0)).toBe('0 drops');
  });
});

describe('stage strip', () => {
  it('marks the stages reached, the current one and those ahead', () => {
    const strip = stageStrip(3);
    expect(strip.map((entry) => entry.state)).toEqual([
      'reached',
      'reached',
      'reached',
      'here',
      'ahead',
      'ahead',
    ]);
    expect(strip.filter((entry) => entry.marker !== '').map((entry) => entry.name)).toEqual([
      'Bud',
    ]);
    expect(strip[0]?.need).toBe('First talk');
    expect(strip[5]?.need).toBe('150 drops');
  });
});
