import type { ReactNode } from 'react';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { groupCard } from './styles';

type Props = {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
};

const { root, heading } = groupCard();

export function GroupCard({ id, title, children, className }: Props) {
  const headingId = `${id}-heading`;
  return (
    <GlassPanel aria-labelledby={headingId} className={root({ className })} id={id}>
      <h2 className={heading()} id={headingId}>
        {title}
      </h2>
      <div>{children}</div>
    </GlassPanel>
  );
}
