import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';
import { radioList } from './styles';

type Option<T extends string> = { value: T; label: string; description?: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  renderAction?: (option: Option<T>) => ReactNode;
  disabled?: boolean;
  className?: string;
};

const { root, row, radio, dot, indicator, copy, label, description } = radioList();

export function RadioList<T extends string>({
  label: groupLabel,
  options,
  value,
  onChange,
  renderAction,
  disabled = false,
  className,
}: Props<T>) {
  return (
    <RadioGroup
      aria-label={groupLabel}
      className={root({ className })}
      data-slot="radio-list"
      disabled={disabled}
      onValueChange={onChange}
      value={value ?? undefined}
    >
      {options.map((option) => (
        <div className={row()} key={option.value}>
          <Radio.Root className={radio()} value={option.value}>
            <span aria-hidden="true" className={dot()}>
              <Radio.Indicator className={indicator()} />
            </span>
            <span className={copy()}>
              <span className={label()}>{option.label}</span>
              {option.description && <span className={description()}>{option.description}</span>}
            </span>
          </Radio.Root>
          {renderAction?.(option)}
        </div>
      ))}
    </RadioGroup>
  );
}
