import { Button as BaseButton } from '@base-ui/react/button';
import type { ReactNode } from 'react';
import { choiceChip } from './styles';

type Props = {
  isSelected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function ChoiceChip({ isSelected, onSelect, disabled = false, className, children }: Props) {
  return (
    <BaseButton
      aria-pressed={isSelected}
      className={choiceChip({ className })}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      {children}
    </BaseButton>
  );
}
