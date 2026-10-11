import { FormRow } from '@/shared/ui/form-row';
import { appearancePreference, THEME_OPTIONS } from '@/theme/themePreference';
import { SegmentedControl } from './SettingsControls';
import { SettingsGroup } from './SettingsGroup';

const OPTIONS = THEME_OPTIONS.map((option) => ({ value: option.id, label: option.label }));

export function AppearanceSettings() {
  const [appearance, setAppearance] = appearancePreference.use();
  return (
    <SettingsGroup id="appearance" title="Appearance">
      <FormRow description="System follows the macOS appearance." title="Theme">
        <SegmentedControl
          label="Theme"
          onChange={(theme) => setAppearance({ theme })}
          options={OPTIONS}
          value={appearance.theme}
        />
      </FormRow>
    </SettingsGroup>
  );
}
