import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';

type Props = { readonly onOpen: () => void };

export function EvaLink({ onOpen }: Props) {
  return (
    <GroupCard id="eva" title="Eva">
      <FormRow
        description="Body, eye, leaf and bloom colours, animation, growth, Dock icon, what each face means."
        title="Look, growth and moods"
      >
        <Button onClick={onOpen} tone="secondary">
          Open
        </Button>
      </FormRow>
    </GroupCard>
  );
}
