// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { activeSettingsSection, isSettingsPath } from './settingsSections';

describe('activeSettingsSection', () => {
  it('follows the hash on the Settings page, with or without the leading #', () => {
    expect(activeSettingsSection('/settings', 'microphone')).toBe('microphone');
    expect(activeSettingsSection('/settings', '#flow')).toBe('flow');
  });

  it('ignores unknown hashes and other pages', () => {
    expect(activeSettingsSection('/settings', 'nope')).toBeUndefined();
    expect(activeSettingsSection('/settings', '')).toBeUndefined();
    expect(activeSettingsSection('/memory', 'voice')).toBeUndefined();
  });

  it('marks Eva on her own page', () => {
    expect(activeSettingsSection('/settings/eva', '')).toBe('eva');
  });
});

describe('isSettingsPath', () => {
  it('covers Settings and its Eva page only', () => {
    expect(isSettingsPath('/settings')).toBe(true);
    expect(isSettingsPath('/settings/eva')).toBe(true);
    expect(isSettingsPath('/memory')).toBe(false);
  });
});
