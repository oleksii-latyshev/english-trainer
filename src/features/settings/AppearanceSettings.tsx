import { appearancePreference, THEME_OPTIONS } from '@/theme/themePreference';
import { SegmentedControl } from './SettingsControls';
import { SettingsGroup, SettingsRow } from './SettingsGroup';

const OPTIONS = THEME_OPTIONS.map((option) => ({ value: option.id, label: option.label }));

export function AppearanceSettings() {
  const [appearance, setAppearance] = appearancePreference.use();
  return (
    <SettingsGroup id="appearance" title="Appearance">
      <SettingsRow description="System follows the macOS appearance." title="Theme">
        <SegmentedControl
          label="Theme"
          onChange={(theme) => setAppearance({ theme })}
          options={OPTIONS}
          value={appearance.theme}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
