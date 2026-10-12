import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { select } from './styles';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const {
  trigger,
  value: valueSlot,
  icon,
  positioner,
  popup,
  list,
  item,
  indicator,
  itemText,
} = select();

export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
}: Props<T>) {
  return (
    <BaseSelect.Root
      disabled={disabled}
      items={options}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
      value={value}
    >
      <BaseSelect.Trigger aria-label={label} className={trigger({ className })}>
        <BaseSelect.Value className={valueSlot()} placeholder={placeholder} />
        <BaseSelect.Icon className={icon()}>
          <ChevronsUpDown aria-hidden="true" className="size-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className={positioner()} sideOffset={6}>
          <BaseSelect.Popup className={popup()}>
            <BaseSelect.List className={list()}>
              {options.map((option) => (
                <BaseSelect.Item className={item()} key={option.value} value={option.value}>
                  <BaseSelect.ItemIndicator className={indicator()}>
                    <Check aria-hidden="true" className="size-4" />
                  </BaseSelect.ItemIndicator>
                  <BaseSelect.ItemText className={itemText()}>{option.label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
