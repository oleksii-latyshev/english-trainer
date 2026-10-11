import type { ReactNode } from 'react';
import type { VariantProps } from 'tailwind-variants';
import { chip } from './styles';

type Props = VariantProps<typeof chip> & { className?: string; children: ReactNode };

export function Chip({ tone, size, className, children }: Props) {
  const { root, label } = chip({ tone, size });
  return (
    <span className={root({ className })} data-slot="chip">
      <span className={label()}>{children}</span>
    </span>
  );
}
