import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { VariantProps } from 'tailwind-variants';
import { segmentedControl } from './styles';

type Option<T extends string | number> = { value: T; label: string };

type Props<T extends string | number> = Pick<VariantProps<typeof segmentedControl>, 'size'> & {
  label: string;
  options: readonly Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
};

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size,
  disabled = false,
  className,
}: Props<T>) {
  const { root, item } = segmentedControl({ size, disabled });

  function handleValueChange(pressed: string[]) {
    const picked = options.find((option) => String(option.value) === pressed[0]);
    if (picked) onChange(picked.value);
  }

  return (
    <ToggleGroup
      aria-label={label}
      className={root({ className })}
      data-slot="segmented-control"
      disabled={disabled}
      onValueChange={handleValueChange}
      value={value === undefined ? [] : [String(value)]}
    >
      {options.map((option) => (
        <Toggle className={item()} key={option.value} value={String(option.value)}>
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
