import { describe, expect, it } from 'bun:test';
import { DEFAULT_PREVIEW_MOOD, EVA_MOOD_GUIDE, moodName } from './index';

describe('Eva mood guide', () => {
  it('explains six distinct faces', () => {
    expect(EVA_MOOD_GUIDE).toHaveLength(6);
    expect(new Set(EVA_MOOD_GUIDE.map((entry) => entry.mood)).size).toBe(6);
  });

  it('previews a face the guide explains', () => {
    expect(EVA_MOOD_GUIDE.map((entry) => entry.mood)).toContain(DEFAULT_PREVIEW_MOOD);
  });

  it('names a mood the way the guide does', () => {
    expect(moodName('idle')).toBe('Encouraging');
    expect(moodName('listening')).toBe('Listening');
  });
});
