import { describe, expect, it } from 'bun:test';
import { type HelpKeyPress, helpLevelForPress } from './index';

function press(key: string, patch: Partial<HelpKeyPress> = {}): HelpKeyPress {
  return { key, isRepeat: false, hasModifier: false, target: 'other', ...patch };
}

const OPEN = { helpLevel: null, isHelpAvailable: true } as const;

describe('help keys', () => {
  it('H opens Frame, then closes; 1, 2 and 3 pick a level and toggle it', () => {
    expect(helpLevelForPress(press('h'), OPEN)).toEqual({ level: 'frame' });
    expect(helpLevelForPress(press('H'), { ...OPEN, helpLevel: 'example' })).toEqual({
      level: null,
    });
    expect(helpLevelForPress(press('2'), OPEN)).toEqual({ level: 'phrases' });
    expect(helpLevelForPress(press('1'), OPEN)).toEqual({ level: 'frame' });
    expect(helpLevelForPress(press('3'), { ...OPEN, helpLevel: 'phrases' })).toEqual({
      level: 'example',
    });
    expect(helpLevelForPress(press('3'), { ...OPEN, helpLevel: 'example' })).toEqual({
      level: null,
    });
  });

  it('ignores keys without help, in text fields, with a modifier or repeated', () => {
    expect(helpLevelForPress(press('h'), { ...OPEN, isHelpAvailable: false })).toBeNull();
    expect(helpLevelForPress(press('h', { target: 'text' }), OPEN)).toBeNull();
    expect(helpLevelForPress(press('h', { hasModifier: true }), OPEN)).toBeNull();
    expect(helpLevelForPress(press('h', { isRepeat: true }), OPEN)).toBeNull();
  });

  it('ignores keys that are not help keys', () => {
    expect(helpLevelForPress(press('x'), OPEN)).toBeNull();
  });
});
