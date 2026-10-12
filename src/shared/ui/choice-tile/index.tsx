import type { ReactNode } from 'react';
import { choiceTile } from './styles';

type Props = {
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
  children: ReactNode;
};

export function ChoiceTile({ isSelected, onSelect, className, children }: Props) {
  return (
    <button
      aria-pressed={isSelected}
      className={choiceTile({ className })}
      onClick={onSelect}
      type="button"
    >
      {children}
    </button>
  );
}
