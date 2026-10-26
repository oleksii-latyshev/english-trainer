import { Progress } from '@base-ui/react/progress';
import type { VariantProps } from 'tailwind-variants';
import { progressBar } from './styles';

type Props = VariantProps<typeof progressBar> & {
  label: string;
  value: number;
  max: number;
  className?: string;
};

export function ProgressBar({ label, value, max, size, className }: Props) {
  const { track, indicator } = progressBar({ size });
  return (
    <Progress.Root aria-label={label} className={className} max={max} min={0} value={value}>
      <Progress.Track className={track()}>
        <Progress.Indicator className={indicator()} />
      </Progress.Track>
    </Progress.Root>
  );
}
