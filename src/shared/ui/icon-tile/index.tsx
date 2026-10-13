import type { ReactNode } from 'react';
import type { VariantProps } from 'tailwind-variants';
import { iconTile } from './styles';

type Props = VariantProps<typeof iconTile> & { children: ReactNode; className?: string };

export function IconTile({ tone, className, children }: Props) {
  return (
    <span aria-hidden="true" className={iconTile({ tone, className })}>
      {children}
    </span>
  );
}
