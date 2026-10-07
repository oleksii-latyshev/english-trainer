import { useNavigate } from '@tanstack/react-router';
import { EVA_SETTINGS_PATH } from '@/lib/settingsSections';
import { SettingsButton } from './SettingsControls';
import { SettingsGroup, SettingsRow } from './SettingsGroup';

export function EvaSettingsLink() {
  const navigate = useNavigate();
  return (
    <SettingsGroup id="eva" title="Eva">
      <SettingsRow
        description="Sphere and eye colours, animation, and what each face means."
        title="Look and moods"
      >
        <SettingsButton onClick={() => void navigate({ to: EVA_SETTINGS_PATH })}>
          Open
        </SettingsButton>
      </SettingsRow>
    </SettingsGroup>
  );
}
