import { expect, it } from 'bun:test';
import { isRescueShortcut, type RescuePress } from './index';

function aPress(overrides: Partial<RescuePress> = {}): RescuePress {
  return {
    key: 's',
    isComposing: false,
    isRepeat: false,
    hasModifier: false,
    target: 'other',
    ...overrides,
  };
}

it('opens on a plain S, in either case', () => {
  expect(isRescueShortcut(aPress())).toBe(true);
  expect(isRescueShortcut(aPress({ key: 'S' }))).toBe(true);
});

it('ignores other keys, repeats, composition and modifiers', () => {
  expect(isRescueShortcut(aPress({ key: 'h' }))).toBe(false);
  expect(isRescueShortcut(aPress({ isRepeat: true }))).toBe(false);
  expect(isRescueShortcut(aPress({ isComposing: true }))).toBe(false);
  expect(isRescueShortcut(aPress({ hasModifier: true }))).toBe(false);
});

it('ignores typing in a field and presses on a control', () => {
  expect(isRescueShortcut(aPress({ target: 'text' }))).toBe(false);
  expect(isRescueShortcut(aPress({ target: 'control' }))).toBe(false);
});
