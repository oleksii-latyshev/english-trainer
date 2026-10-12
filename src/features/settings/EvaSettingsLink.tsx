import { useNavigate } from '@tanstack/react-router';
import { EVA_SETTINGS_PATH } from '@/lib/settingsSections';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';

export function EvaSettingsLink() {
  const navigate = useNavigate();
  return (
    <GroupCard id="eva" title="Eva">
      <FormRow
        description="Body, eye, leaf and bloom colours, animation, growth, Dock icon, what each face means."
        title="Look, growth and moods"
      >
        <Button onClick={() => void navigate({ to: EVA_SETTINGS_PATH })} tone="secondary">
          Open
        </Button>
      </FormRow>
    </GroupCard>
  );
}
