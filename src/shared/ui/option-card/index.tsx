import { Button as BaseButton } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import { optionCard } from './styles';

type Props = {
  isSelected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  className?: string;
};

export function OptionCard({
  isSelected,
  onSelect,
  icon,
  title,
  description,
  disabled = false,
  className,
}: Props) {
  const slots = optionCard({ selected: isSelected });
  return (
    <BaseButton
      aria-pressed={isSelected}
      className={slots.root({ className })}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span aria-hidden="true" className={slots.icon()}>
        {icon}
      </span>
      <span className={slots.title()}>{title}</span>
      <span className={slots.description()}>{description}</span>
    </BaseButton>
  );
}
