import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { type ReactNode, useId } from 'react';
import { switchControl } from './styles';

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
};

export function Switch({ checked, onCheckedChange, label, disabled = false, className }: Props) {
  const id = useId();
  const { root, text, control, thumb } = switchControl({ disabled });
  return (
    <div className={root({ className })} data-slot="switch">
      <label className={text()} htmlFor={id}>
        {label}
      </label>
      <BaseSwitch.Root
        checked={checked}
        className={control()}
        disabled={disabled}
        id={id}
        nativeButton
        onCheckedChange={onCheckedChange}
        render={<button type="button" />}
      >
        <BaseSwitch.Thumb className={thumb()} />
      </BaseSwitch.Root>
    </div>
  );
}
