import type { VariantProps } from 'tailwind-variants';
import { swatch } from './styles';

type Props = VariantProps<typeof swatch> & {
  name: string;
  background: string;
  isSelected: boolean;
  onSelect: () => void;
  lockedHint?: string;
};

export function Swatch({ shape, name, background, isSelected, onSelect, lockedHint }: Props) {
  return (
    <button
      aria-label={name}
      aria-pressed={isSelected}
      className={swatch({ shape })}
      disabled={lockedHint !== undefined}
      onClick={onSelect}
      style={{ background }}
      title={lockedHint ?? name}
      type="button"
    />
  );
}
