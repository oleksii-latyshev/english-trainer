import type { VariantProps } from 'tailwind-variants';
import { heatCell } from './styles';

type Props = VariantProps<typeof heatCell> & { label?: string; className?: string };

export function HeatCell({ level, today, upcoming, label, className }: Props) {
  return <span className={heatCell({ level, today, upcoming, className })} title={label} />;
}
