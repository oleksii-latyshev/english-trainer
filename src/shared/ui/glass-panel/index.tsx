import type { ReactNode } from 'react';
import { glassPanel } from './styles';

type Props = {
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
  children: ReactNode;
};

export function GlassPanel({ className, children, ...rest }: Props) {
  return (
    <section className={glassPanel({ className })} {...rest}>
      {children}
    </section>
  );
}
