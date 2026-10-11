import type { ReactNode } from 'react';
import type { VariantProps } from 'tailwind-variants';
import { notice } from './styles';

type Props = VariantProps<typeof notice> & {
  role?: 'alert' | 'status';
  className?: string;
  children: ReactNode;
};

export function Notice({ tone = 'plain', role, className, children }: Props) {
  return (
    <div className={notice({ tone, className })} data-slot="notice" data-tone={tone} role={role}>
      {children}
    </div>
  );
}
