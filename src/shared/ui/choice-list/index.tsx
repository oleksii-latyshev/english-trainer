import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { ListRowText } from '@/shared/ui/list-group';
import { listGroup, listRow } from '@/shared/ui/list-group/styles';
import { choiceList } from './styles';

type Option<T extends string> = {
  value: T;
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: ReactNode;
};

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  renderLeading?: (option: Option<T>) => ReactNode;
  disabled?: boolean;
  className?: string;
};

const { radio, check } = choiceList();
const { root: row } = listRow();

export function ChoiceList<T extends string>({
  label,
  options,
  value,
  onChange,
  renderLeading,
  disabled = false,
  className,
}: Props<T>) {
  function handleValueChange(next: string) {
    const picked = options.find((option) => option.value === next);
    if (picked) onChange(picked.value);
  }

  return (
    <RadioGroup
      aria-label={label}
      className={listGroup({ className })}
      disabled={disabled}
      onValueChange={handleValueChange}
      value={value ?? ''}
    >
      {options.map((option) => {
        const leading = renderLeading?.(option);
        return (
          <div
            className={row({ inset: leading !== undefined || option.icon !== undefined })}
            key={option.value}
          >
            {leading}
            <Radio.Root className={radio()} value={option.value}>
              {option.icon}
              <ListRowText badge={option.badge} subtitle={option.subtitle} title={option.title} />
              <Radio.Indicator className={check()}>
                <Check aria-hidden="true" size={18} strokeWidth={2.4} />
              </Radio.Indicator>
            </Radio.Root>
          </div>
        );
      })}
    </RadioGroup>
  );
}
