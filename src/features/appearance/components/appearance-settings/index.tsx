import { useAtom } from '@effect/atom-react';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { appearanceAtom } from '../../model/atoms';
import { THEME_OPTIONS } from '../../theme';

export function AppearanceSettings() {
  const [appearance, setAppearance] = useAtom(appearanceAtom);
  return (
    <GroupCard id="appearance" title="Appearance">
      <FormRow description="System follows the macOS appearance." title="Theme">
        <SegmentedControl
          label="Theme"
          onChange={(theme) => setAppearance({ theme })}
          options={THEME_OPTIONS}
          value={appearance.theme}
        />
      </FormRow>
    </GroupCard>
  );
}
