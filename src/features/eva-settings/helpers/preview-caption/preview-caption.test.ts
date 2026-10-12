import { describe, expect, it } from 'bun:test';
import { DEFAULT_PREVIEW_STAGE, growthHint, PREVIEW_STAGES, stageCaption } from './index';

describe('preview caption', () => {
  it('names the stage the preview shows', () => {
    expect(stageCaption(4, true)).toBe('Bloom');
    expect(stageCaption(1, true)).toBe('Sprout');
  });

  it('says the plant is hidden when growth is off', () => {
    expect(stageCaption(4, false)).toBe('Growth hidden');
  });

  it('previews a stage the picker offers', () => {
    expect(PREVIEW_STAGES.some((stage) => stage.value === DEFAULT_PREVIEW_STAGE)).toBe(true);
  });

  it('explains both positions of the growth switch', () => {
    expect(growthHint(true)).not.toBe(growthHint(false));
  });
});
