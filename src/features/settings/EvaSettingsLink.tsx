import { useNavigate } from '@tanstack/react-router';
import { EVA_SETTINGS_PATH } from '@/lib/settingsSections';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { SettingsGroup } from './SettingsGroup';

export function EvaSettingsLink() {
  const navigate = useNavigate();
  return (
    <SettingsGroup id="eva" title="Eva">
      <FormRow
        description="Sphere and eye colours, animation, and what each face means."
        title="Look and moods"
      >
        <Button onClick={() => void navigate({ to: EVA_SETTINGS_PATH })}>Open</Button>
      </FormRow>
    </SettingsGroup>
  );
}
